"""SIH26145 passive flow engine: metadata in, intelligence out; no return traffic."""
from __future__ import annotations
import asyncio, hashlib, ipaddress, math, time, uuid
from collections import Counter, deque
from datetime import datetime, timezone
from typing import Any
from app.db.session import SessionLocal
from app.models.threat_event import ThreatEvent
from app.models.unidirectional import NetworkBaseline, ReplayBenchmark, UnidirectionalAlert, UnidirectionalFlow
from app.services.websocket_manager import ConnectionManager
from app.core.config import settings
from app.services.unidirectional.ml import anomaly_model
from app.services.unidirectional.features import ngram_score

SCENARIOS={"normal":"Normal traffic","syn_flood":"SYN flood","udp_amplification":"UDP amplification","spoofed_source_flood":"Spoofed-source flood","c2":"C2 beaconing","dga":"DGA domain","dns_tunnel":"DNS tunnelling","tls_malware":"Encrypted metadata anomaly","port_scan":"Port scan","host_scan":"Host scan","exfiltration":"Data exfiltration"}
def entropy(v:str)->float:
 c=Counter(v); return -sum((n/len(v))*math.log2(n/len(v)) for n in c.values()) if v else 0.
def dga_score(domain:str)->float:
 l=domain.split('.')[0]; return min(1.,entropy(l)/4.5*.75+sum(c.isdigit() for c in l)/max(len(l),1)*.25)

class PassiveTrafficEngine:
 def __init__(self):
  self.mode,self.scenario,self.speed="STOPPED","normal",1.; self.flow_count=self.alert_count=0
  self.flows,self.alerts,self.timeline=deque(maxlen=1000),deque(maxlen=500),deque(maxlen=900)
  self.task=self.replay_task=None; self.ws=ConnectionManager(); self.queue=asyncio.Queue(maxsize=1000)
  self.worker_tasks=[];self.source_destinations={};self.source_ports={};self.recent_alert_keys={}
  self.replay={"running":False,"processed":0,"alerts":0,"total":0,"speed":1.,"average_latency_ms":0.}; self.benchmarks=deque(maxlen=10)
 def overview(self):
  r=list(self.flows)[:60]
  return {"air_gap":{"mode":"PASSIVE","read_only":True,"ingestion":"ACTIVE","direction":"INBOUND ONLY","return_path":"BLOCKED","payload_decryption":"DISABLED","active_probes":0,"packet_injection":0},"traffic":{"packets_per_second":round(sum(x["packets_per_second"] for x in r),2),"bytes_per_second":round(sum(x["bytes_per_second"] for x in r),2),"flows_per_second":round(len(r)/60,3),"active_flows":len(r)},"pipeline":{"queue_depth":self.queue.qsize(),"flows_processed_total":self.flow_count,"alerts_generated_total":self.alert_count,"workers":len(self.worker_tasks) or settings.unidirectional_workers},"ml":{"model":anomaly_model.version,"available":anomaly_model.available,"mode":"local_optional"},"simulation":{"mode":self.mode,"scenario":self.scenario,**self.replay},"timeline":list(self.timeline)[-60:],"alerts":list(self.alerts)[:100],"flows":list(self.flows)[:200]}
 async def start_workers(self):
  if self.worker_tasks:return
  async def worker():
   while True:
    raw,source=await self.queue.get()
    try:await self.analyse(raw,source)
    except Exception:pass
    finally:self.queue.task_done()
  self.worker_tasks=[asyncio.create_task(worker()) for _ in range(max(1,settings.unidirectional_workers))]
 async def submit(self,raw,source="flow_record"):
  try:self.queue.put_nowait((raw,source));return True
  except asyncio.QueueFull:return False
 async def start(self,scenario:str,speed:float=1.):
  if scenario not in SCENARIOS: raise ValueError("Unsupported passive simulation scenario")
  await self.stop(); self.mode,self.scenario,self.speed="RUNNING",scenario,min(max(speed,.5),100); self.task=asyncio.create_task(self._stream()); return self.overview()
 async def stop(self):
  self.mode="STOPPED"
  for t in (self.task,self.replay_task):
   if t and t is not asyncio.current_task(): t.cancel()
  self.task=self.replay_task=None; self.replay["running"]=False; return self.overview()
 async def shutdown(self):
  await self.stop()
  for task in self.worker_tasks: task.cancel()
  self.worker_tasks=[]
 async def pause(self): self.mode="PAUSED"; return self.overview()
 def reset(self): self.flows.clear();self.alerts.clear();self.timeline.clear();self.flow_count=self.alert_count=0;return self.overview()
 async def _stream(self):
  while self.mode!="STOPPED":
   if self.mode=="RUNNING": await self.analyse(self.synthetic_flow(self.scenario),self.scenario)
   await asyncio.sleep(1/self.speed)
 def synthetic_flow(self,s):
  b={"source_ip":"10.10.2.15","destination_ip":"203.0.113.42","source_port":52144,"destination_port":443,"protocol":"TCP","packet_count":10,"byte_count":12000,"duration_seconds":10,"iat_mean":1,"iat_std":.4,"unique_ports":1,"unique_destinations":1,"inbound_bytes":10000,"outbound_bytes":2000,"dns_queries":[]}
  v={"syn_flood":{"packet_count":3000,"duration_seconds":2,"syn_rate":1450},"udp_amplification":{"protocol":"UDP","packet_count":4000,"byte_count":8000000,"duration_seconds":2},"spoofed_source_flood":{"packet_count":3500,"duration_seconds":2},"c2":{"packet_count":8,"duration_seconds":240,"iat_mean":30,"iat_std":1},"dga":{"protocol":"DNS","destination_port":53,"dns_queries":["x7k29asd91kqz8vn4m2.example.com"]},"dns_tunnel":{"protocol":"DNS","destination_port":53,"dns_queries":["a9dk3lx0m2p4q8s6z7r5n1b2c3d4e5f6.payload.example.com"]*12},"tls_malware":{"packet_count":180,"duration_seconds":2,"iat_mean":.02,"iat_std":.001,"ja3":"unrecognized"},"port_scan":{"packet_count":80,"duration_seconds":2,"unique_ports":42},"host_scan":{"packet_count":80,"duration_seconds":2,"unique_destinations":30},"exfiltration":{"packet_count":700,"byte_count":15000000,"duration_seconds":20,"inbound_bytes":150000,"outbound_bytes":15000000,"direction":"OUTBOUND"}}
  return {**b,**v.get(s,{})}
 def _flow_for_test(self,s):
  raw=self.synthetic_flow(s);p=raw["packet_count"];d=raw["duration_seconds"]
  return {"protocol":raw["protocol"],"packets_per_second":p/d,"packet_count":p,"iat_mean":raw.get("iat_mean",0),"iat_std":raw.get("iat_std",0),"destination_port":raw.get("destination_port",0),"ja3":raw.get("ja3"),"unique_ports":raw.get("unique_ports",1),"unique_destinations":raw.get("unique_destinations",1),"outbound_bytes":raw.get("outbound_bytes",raw.get("byte_count",0)),"inbound_bytes":raw.get("inbound_bytes",1),"dns_queries":raw.get("dns_queries",[])}
 async def analyse(self,raw:dict[str,Any],simulation:str|None=None):
  now=datetime.now(timezone.utc).isoformat(); p=max(int(raw.get("packet_count",1)),1); b=max(int(raw.get("byte_count",0)),0); d=max(float(raw.get("duration_seconds",1)),.001)
  src,dst=raw.get("source_ip","0.0.0.0"),raw.get("destination_ip","0.0.0.0");self.source_destinations.setdefault(src,set()).add(dst);self.source_ports.setdefault(src,set()).add(int(raw.get("destination_port",0)))
  protected=[ipaddress.ip_network(x.strip()) for x in settings.unidirectional_protected_cidrs.split(",") if x.strip()]
  source_internal=any(ipaddress.ip_address(src) in net for net in protected) if protected else None
  inbound,outbound=(int(raw.get("inbound_bytes",0)),int(raw.get("outbound_bytes",0))) if raw.get("inbound_bytes") or raw.get("outbound_bytes") else ((1,b) if source_internal else (b,1) if source_internal is False else (0,0))
  f={"flow_id":raw.get("flow_id") or hashlib.sha256(f"{src}{dst}{now}".encode()).hexdigest()[:20],"timestamp":now,"source_ip":src,"destination_ip":dst,"source_port":int(raw.get("source_port",0)),"destination_port":int(raw.get("destination_port",0)),"protocol":str(raw.get("protocol","TCP")).upper(),"packet_count":p,"byte_count":b,"duration_seconds":d,"packets_per_second":p/d,"bytes_per_second":b/d,"iat_mean":float(raw.get("iat_mean",0)),"iat_std":float(raw.get("iat_std",0)),"syn_rate":float(raw.get("syn_rate",0)),"unique_ports":max(int(raw.get("unique_ports",1)),len(self.source_ports[src])),"unique_destinations":max(int(raw.get("unique_destinations",1)),len(self.source_destinations[src])),"inbound_bytes":inbound,"outbound_bytes":outbound,"outbound_inbound_ratio":outbound/max(inbound,1) if inbound else 0,"dns_queries":list(raw.get("dns_queries",[]))[:50],"ja3":raw.get("ja3"),"tls_version":raw.get("tls_version"),"cipher":raw.get("cipher"),"metadata_only":True,"payload_decryption":"DISABLED","direction":raw.get("direction") or ("OUTBOUND" if source_internal else "INBOUND" if source_internal is False else "OBSERVED")}
  anomaly_model.learn(f);f["ml_anomaly_score"]=anomaly_model.score(f)
  ds=self.detect(f); self.flow_count+=1;self.flows.appendleft(f);self.persist_flow(f);self.timeline.append({"timestamp":now,"packets_per_second":f["packets_per_second"],"bytes_per_second":f["bytes_per_second"],"flows_per_second":1}); a=self.fuse(f,ds)
  if a: self.alerts.appendleft(a);self.alert_count+=1;self.persist(a);await self.ws.broadcast_json({"type":"alert","channel":"unidirectional_alert","data":a,"payload":a})
  await self.ws.broadcast_json({"type":"flow","channel":"unidirectional_flow","data":f,"payload":f});await self.ws.broadcast_json({"type":"metrics","channel":"unidirectional_metrics","data":self.overview(),"payload":self.overview()});await self.ws.broadcast_json({"channel":"unidirectional_update","payload":self.overview()});return {"flow":f,"alert":a}
 def detect(self,f):
  o=[];r=f["packets_per_second"]
  if r>=500:o.append({"class":"SYN_FLOOD" if f["protocol"]=="TCP" else "UDP_AMPLIFICATION" if f["protocol"]=="UDP" else "SPOOFED_SOURCE_FLOOD","score":min(1,r/1500),"method":"ddos_heuristic","evidence":{"packets_per_second":round(r,2),"syn_rate":f.get("syn_rate",0)}})
  if f["packet_count"]>=4 and f["iat_mean"]>0 and f["iat_std"]/f["iat_mean"]<.1:o.append({"class":"C2_BEACON","score":round(1-f["iat_std"]/f["iat_mean"],3),"method":"periodicity","evidence":{"mean_interval":f["iat_mean"],"interval_std":f["iat_std"]}})
  for q in f["dns_queries"]:
   l=q.split('.')[0];s=min(1,dga_score(q)+ngram_score(l)*.15);t=min(1,entropy(l)/4.5*.55+min(len(l)/60,1)*.3+min(len(f["dns_queries"])/10,1)*.15)
   if s>=.65:o.append({"class":"DGA","score":s,"method":"dns_entropy","evidence":{"domain":q,"entropy":round(entropy(l),3),"dga_score":s}})
   if t>=.7:o.append({"class":"DNS_TUNNEL","score":round(t,3),"method":"dns_tunnelling","evidence":{"query_length":len(l),"subdomain_entropy":round(entropy(l),3),"query_frequency":len(f["dns_queries"]),"dns_tunneling_score":round(t,3)}})
  if f["ja3"]=="unrecognized" or(f["destination_port"]==443 and f["packet_count"]>100 and f["iat_mean"] and f["iat_std"]/f["iat_mean"]<.1):o.append({"class":"ENCRYPTED_SESSION_ANOMALY","score":.78,"method":"tls_metadata_anomaly","evidence":{"ja3":f["ja3"],"payload_not_decrypted":True}})
  if max(f["unique_ports"],f["unique_destinations"])>=16:o.append({"class":"RECONNAISSANCE","score":min(1,max(f["unique_ports"],f["unique_destinations"])/40),"method":"fanout_heuristic","evidence":{"unique_ports":f["unique_ports"],"unique_destinations":f["unique_destinations"],"scan_velocity":round(r,2)}})
  ratio=f["outbound_bytes"]/max(f["inbound_bytes"],1)
  if f["direction"]=="OUTBOUND" and f["outbound_bytes"]>=5000000 and ratio>=2:o.append({"class":"DATA_EXFILTRATION","score":min(1,.5+ratio/10),"method":"flow_asymmetry","evidence":{"outbound_bytes":f["outbound_bytes"],"inbound_bytes":f["inbound_bytes"],"byte_ratio":round(ratio,2)}})
  return o
 def fuse(self,f,ds):
  if not ds:return None
  x=max(ds,key=lambda a:a["score"]);risk=round(x["score"]*100);sev="CRITICAL" if risk>=90 else "HIGH" if risk>=75 else "MEDIUM" if risk>=50 else "LOW"
  return {"alert_id":f"ALT-{datetime.now(timezone.utc):%Y}-{uuid.uuid4().hex[:6].upper()}","timestamp":f["timestamp"],"flow_id":f["flow_id"],"threat_class":x["class"],"severity":sev,"confidence":round(min(.99,.45+x["score"]*.5+min(len(ds)*.03,.09)),3),"risk_score":risk,"source":f["source_ip"],"destination":f["destination_ip"],"protocol":f["protocol"],"evidence":{"signals":[d["evidence"] for d in ds],"final_score":x["score"]},"detection_method":"+".join(d["method"] for d in ds),"model":"ensemble-v1","metadata_only":True,"recommended_action":"Investigate observed endpoint and preserve evidence. This passive system cannot issue containment commands."}
 def persist(self,a):
  db=SessionLocal()
  try:db.add(ThreatEvent(event_type=a["threat_class"],source_ip=a["source"],severity=a["severity"],confidence=a["confidence"],description="Passive SIH26145 unidirectional detection",event_metadata=a));db.add(UnidirectionalAlert(alert_id=a["alert_id"],flow_id=a["flow_id"],threat_class=a["threat_class"],severity=a["severity"],confidence=a["confidence"],risk_score=a["risk_score"],source_ip=a["source"],destination_ip=a["destination"],protocol=a["protocol"],evidence=a["evidence"],detection_method=a["detection_method"],model_name=a["model"]));db.commit()
  finally:db.close()
 def persist_flow(self,f):
  db=SessionLocal()
  try:
   db.add(UnidirectionalFlow(flow_id=f["flow_id"],source_ip=f["source_ip"],destination_ip=f["destination_ip"],protocol=f["protocol"],packet_count=f["packet_count"],byte_count=f["byte_count"],duration_seconds=f["duration_seconds"],features=f));base=db.query(NetworkBaseline).filter(NetworkBaseline.source_ip==f["source_ip"]).first()
   if base is None: db.add(NetworkBaseline(source_ip=f["source_ip"],sample_count=1,mean_bytes=f["byte_count"],mean_packets=f["packet_count"]))
   else:
    n=base.sample_count+1;base.mean_bytes=(base.mean_bytes*base.sample_count+f["byte_count"])/n;base.mean_packets=(base.mean_packets*base.sample_count+f["packet_count"])/n;base.sample_count=n
   db.commit()
  finally:db.close()
 async def start_replay(self,scenarios,speed):
  if self.replay["running"]:raise ValueError("Replay already running")
  self.replay.update({"running":True,"processed":0,"alerts":0,"total":len(scenarios),"speed":speed,"average_latency_ms":0.})
  async def run():
   ts=[]
   try:
    for s in scenarios:
     if s not in SCENARIOS:continue
     t=time.perf_counter();z=await self.analyse(self.synthetic_flow(s),s);ts.append((time.perf_counter()-t)*1000);self.replay["processed"]+=1;self.replay["alerts"]+=bool(z["alert"]);self.replay["average_latency_ms"]=round(sum(ts)/len(ts),2);await asyncio.sleep(1/speed)
   finally:self.replay["running"]=False
  self.replay_task=asyncio.create_task(run());return self.replay
 async def benchmark(self,flows):
  t=time.perf_counter()
  for _ in range(flows):await self.analyse(self.synthetic_flow("normal"))
  s=time.perf_counter()-t;r={"timestamp":datetime.now(timezone.utc).isoformat(),"flows_tested":flows,"elapsed_seconds":round(s,4),"measured_flows_per_second":round(flows/max(s,.000001),2),"note":"Measured locally through the real passive pipeline; not a production capacity claim."};self.benchmarks.appendleft(r);db=SessionLocal()
  try:db.add(ReplayBenchmark(flows_tested=flows,elapsed_seconds=s,measured_flows_per_second=r["measured_flows_per_second"],result=r));db.commit()
  finally:db.close()
  return r
traffic_engine=PassiveTrafficEngine()
