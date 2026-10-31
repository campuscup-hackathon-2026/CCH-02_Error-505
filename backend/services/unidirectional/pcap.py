"""Read-only PCAP-to-flow extraction. Packet payloads are never retained."""
from __future__ import annotations

from collections import defaultdict
from pathlib import Path
from typing import Any

try:
    from scapy.all import DNS, IP, IPv6, TCP, UDP, PcapReader
except ImportError:
    DNS = IP = IPv6 = TCP = UDP = PcapReader = None

def extract_flows(path: str | Path, idle_timeout: float = 120.0) -> list[dict[str, Any]]:
    if PcapReader is None:
        raise RuntimeError("Scapy is unavailable; install the PCAP optional dependency")
    active: dict[tuple, dict[str, Any]] = {}
    completed: list[dict[str, Any]] = []
    with PcapReader(str(path)) as reader:
        for packet in reader:
            if not (packet.haslayer(IP) or packet.haslayer(IPv6)): continue
            ip = packet[IP] if packet.haslayer(IP) else packet[IPv6]
            protocol, sport, dport = "IP", 0, 0
            if packet.haslayer(TCP): protocol, sport, dport = "TCP", int(packet[TCP].sport), int(packet[TCP].dport)
            elif packet.haslayer(UDP): protocol, sport, dport = "UDP", int(packet[UDP].sport), int(packet[UDP].dport)
            timestamp = float(packet.time); key = (str(ip.src), str(ip.dst), sport, dport, protocol)
            flow = active.get(key)
            if flow and timestamp - flow["last_seen"] > idle_timeout:
                completed.append(flow); flow = None
            if flow is None:
                flow = active[key] = {"source_ip": key[0], "destination_ip": key[1], "source_port": sport, "destination_port": dport, "protocol": protocol, "packet_count": 0, "byte_count": 0, "first_seen": timestamp, "last_seen": timestamp, "iat_values": [], "dns_queries": [], "dns_record_types": [], "syn_count": 0}
            if flow["packet_count"]: flow["iat_values"].append(timestamp - flow["last_seen"])
            flow["last_seen"] = timestamp; flow["packet_count"] += 1; flow["byte_count"] += len(packet)
            if packet.haslayer(TCP) and "S" in str(packet[TCP].flags): flow["syn_count"] += 1
            if DNS is not None and packet.haslayer(DNS) and int(packet[DNS].qr) == 0 and getattr(packet[DNS], "qd", None):
                query = bytes(packet[DNS].qd.qname).rstrip(b".").decode("idna", errors="replace")
                flow["dns_queries"].append(query[:255])
                flow["dns_record_types"].append(str(int(packet[DNS].qd.qtype)))
    completed.extend(active.values())
    output = []
    for flow in completed:
        duration = max(flow.pop("last_seen") - flow.pop("first_seen"), .001); iats = flow.pop("iat_values")
        flow["duration_seconds"] = duration
        flow["iat_mean"] = sum(iats) / len(iats) if iats else 0.0
        flow["iat_std"] = (sum((item - flow["iat_mean"]) ** 2 for item in iats) / len(iats)) ** .5 if iats else 0.0
        flow["syn_rate"] = flow.pop("syn_count") / duration
        output.append(flow)
    return output
