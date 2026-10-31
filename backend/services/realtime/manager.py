from __future__ import annotations

import asyncio
import queue
import threading
import time
from collections import Counter, deque
from datetime import datetime, timezone
from typing import Any

from app.services.websocket_manager import ConnectionManager
from app.services.realtime.baseline import AdaptiveBaseline
from app.core.config import settings


class LiveCaptureManager:
    """Captures packets passively with Scapy AsyncSniffer and publishes aggregates only."""

    def __init__(self) -> None:
        self.status = "STOPPED"
        self.interface: str | None = None
        self.error: str | None = None
        self.started_at: float | None = None
        self.captured = self.processed = self.dropped = 0
        self.bytes_captured = 0
        self.flows: dict[tuple[str, str, int, int, str], dict[str, Any]] = {}
        self.recent_packets: deque[dict[str, Any]] = deque(maxlen=100)
        self.protocols: Counter[str] = Counter()
        self.baseline = AdaptiveBaseline()
        self.protocol_deviations: dict[str, dict[str, Any]] = {}
        self._lock = threading.Lock()
        self._queue: queue.Queue[Any] = queue.Queue(maxsize=10_000)
        self._sniffer: Any = None
        self._worker: threading.Thread | None = None
        self._stop = threading.Event()
        self.ws = ConnectionManager()
        self._publisher: asyncio.Task | None = None
        self._flow_sink: Any = None
        self._last_emitted_packets: dict[tuple[str, str, int, int, str], int] = {}

    def set_flow_sink(self, sink: Any) -> None:
        """Register the passive SIH flow consumer. The sink receives metadata only."""
        self._flow_sink = sink

    @staticmethod
    def interfaces() -> dict[str, Any]:
        try:
            from scapy.all import get_if_list
            return {"available": True, "interfaces": get_if_list(), "capture_library": "scapy"}
        except Exception as exc:
            return {"available": False, "interfaces": [], "reason": f"Live capture unavailable: {exc}"}

    def overview(self) -> dict[str, Any]:
        with self._lock:
            elapsed = max(time.monotonic() - self.started_at, 0.001) if self.started_at else 0
            active_flows = list(self.flows.values())[-40:]
            return {"source": "LIVE_INTERFACE", "status": self.status, "interface": self.interface, "error": self.error, "passive": {"read_only": True, "outbound_application_connections": 0, "active_probes": 0, "packet_injection": 0, "payload_decryption": "OFF"}, "metrics": {"packets_captured": self.captured, "packets_processed": self.processed, "bytes_captured": self.bytes_captured, "packets_per_second": round(self.captured / elapsed, 2) if elapsed else 0, "bytes_per_second": round(self.bytes_captured / elapsed, 2) if elapsed else 0, "active_flows": len(self.flows), "dropped_packets": self.dropped, "queue_depth": self._queue.qsize(), "duration_seconds": round(elapsed, 1), "protocols": dict(self.protocols)}, "baseline": {"method": "EWMA", "minimum_samples": self.baseline.minimum_samples, "protocol_deviations": self.protocol_deviations, "profiles": self.baseline.snapshot()}, "flows": active_flows, "packets": list(self.recent_packets)[-30:][::-1]}

    async def start(self, interface: str) -> dict[str, Any]:
        if self.status == "LIVE":
            return self.overview()
        try:
            from scapy.all import AsyncSniffer
        except Exception as exc:
            self.status, self.error = "ERROR", f"Scapy is unavailable: {exc}"
            return self.overview()
        allowed = {name.strip() for name in settings.unidirectional_allowed_interfaces.split(",") if name.strip()}
        if allowed and interface not in allowed:
            self.status, self.error = "ERROR", "Interface is not allow-listed for the passive ingest boundary"
            return self.overview()
        self.status, self.interface, self.error = "STARTING", interface, None
        self._stop.clear()
        self.started_at = time.monotonic()
        try:
            self._sniffer = AsyncSniffer(iface=interface, prn=self._capture_callback, store=False)
            self._sniffer.start()
            self._worker = threading.Thread(target=self._process_loop, name="sentinel-passive-processor", daemon=True)
            self._worker.start()
            self._publisher = asyncio.create_task(self._publish_loop())
            self.status = "LIVE"
        except Exception as exc:
            self.status, self.error = "ERROR", f"Unable to start passive capture on {interface}: {exc}"
        return self.overview()

    async def pause(self) -> dict[str, Any]:
        # Capture is stopped rather than buffered while paused, preserving bounded memory.
        return await self.stop(status="PAUSED")

    async def stop(self, status: str = "STOPPED") -> dict[str, Any]:
        self._stop.set()
        if self._sniffer:
            try:
                self._sniffer.stop()
            except Exception:
                pass
        self._sniffer = None
        if self._worker and self._worker.is_alive():
            self._worker.join(timeout=2)
        self._worker = None
        if self._publisher:
            self._publisher.cancel()
            self._publisher = None
        self.status = status
        return self.overview()

    def _capture_callback(self, packet: Any) -> None:
        with self._lock:
            self.captured += 1
            self.bytes_captured += len(packet)
        try:
            self._queue.put_nowait(packet)
        except queue.Full:
            with self._lock:
                self.dropped += 1

    def _process_loop(self) -> None:
        while not self._stop.is_set() or not self._queue.empty():
            try:
                packet = self._queue.get(timeout=0.2)
            except queue.Empty:
                continue
            normalized = self._normalize(packet)
            if normalized:
                self._update_flow(normalized)
            with self._lock:
                self.processed += 1

    def _normalize(self, packet: Any) -> dict[str, Any] | None:
        try:
            from scapy.all import DNS, IP, IPv6, TCP, UDP, ICMP
            network = packet.getlayer(IP) or packet.getlayer(IPv6)
            if not network:
                return None
            transport = packet.getlayer(TCP) or packet.getlayer(UDP) or packet.getlayer(ICMP)
            protocol = "TCP" if packet.haslayer(TCP) else "UDP" if packet.haslayer(UDP) else "ICMP" if packet.haslayer(ICMP) else str(getattr(network, "nh", "OTHER"))
            source_port = int(getattr(transport, "sport", 0) or 0)
            destination_port = int(getattr(transport, "dport", 0) or 0)
            if destination_port == 53 or source_port == 53: protocol = "DNS"
            elif destination_port == 443 or source_port == 443: protocol = "TLS"
            dns_query = None
            if packet.haslayer(DNS) and int(packet[DNS].qr) == 0 and getattr(packet[DNS], "qd", None):
                dns_query = bytes(packet[DNS].qd.qname).rstrip(b".").decode("idna", errors="replace")[:255]
            return {"time": datetime.now(timezone.utc).isoformat(), "source": network.src, "destination": network.dst, "source_port": source_port, "destination_port": destination_port, "protocol": protocol, "size": len(packet), "tcp_flags": str(getattr(transport, "flags", "")), "dns_query": dns_query, "risk": "LOW"}
        except Exception:
            return None

    def _update_flow(self, packet: dict[str, Any]) -> None:
        key = (packet["source"], packet["destination"], packet["source_port"], packet["destination_port"], packet["protocol"])
        now = time.monotonic()
        with self._lock:
            flow = self.flows.setdefault(key, {"source": packet["source"], "destination": packet["destination"], "source_port": packet["source_port"], "port": packet["destination_port"], "protocol": packet["protocol"], "packets": 0, "bytes": 0, "first_seen": packet["time"], "last_seen": packet["time"], "started": now, "last_tick": now, "iat_values": deque(maxlen=64), "dns_queries": deque(maxlen=50), "syn_count": 0, "risk": "LOW"})
            if flow["packets"]:
                flow["iat_values"].append(now - flow["last_tick"])
            flow["last_tick"] = now
            if "S" in packet["tcp_flags"]: flow["syn_count"] += 1
            if packet.get("dns_query"): flow["dns_queries"].append(packet["dns_query"])
            flow["packets"] += 1; flow["bytes"] += packet["size"]; flow["last_seen"] = packet["time"]; flow["duration"] = round(now - flow["started"], 2)
            self.protocols[packet["protocol"]] += 1
            self.protocol_deviations[packet["protocol"]] = self.baseline.observe(f"packet_size:{packet['protocol']}", float(packet["size"]))
            self.recent_packets.append(packet)
            cutoff = now - 300
            self.flows = {flow_key: value for flow_key, value in self.flows.items() if value["started"] >= cutoff}

    async def _publish_loop(self) -> None:
        while self.status == "LIVE":
            await self._emit_sih_flows()
            await self.ws.broadcast_json({"type": "traffic_update", "timestamp": datetime.now(timezone.utc).isoformat(), "payload": self.overview()})
            await asyncio.sleep(settings.unidirectional_live_emit_interval_seconds)

    async def _emit_sih_flows(self) -> None:
        """Forward only changed aggregate metadata into the shared SIH pipeline."""
        if self._flow_sink is None:
            return
        with self._lock:
            snapshots = [(key, dict(value)) for key, value in self.flows.items()]
        for key, flow in snapshots:
            previous = self._last_emitted_packets.get(key, 0)
            if flow["packets"] <= previous:
                continue
            self._last_emitted_packets[key] = flow["packets"]
            duration = max(float(flow.get("duration", 0)), 0.001)
            metadata = {
                "source_ip": flow["source"], "destination_ip": flow["destination"], "source_port": flow["source_port"],
                "destination_port": flow["port"], "protocol": flow["protocol"],
                "packet_count": flow["packets"], "byte_count": flow["bytes"],
                "duration_seconds": duration, "iat_mean": sum(flow["iat_values"]) / len(flow["iat_values"]) if flow["iat_values"] else 0.0,
                "iat_std": (sum((x - (sum(flow["iat_values"]) / len(flow["iat_values"]))) ** 2 for x in flow["iat_values"]) / len(flow["iat_values"])) ** .5 if flow["iat_values"] else 0.0,
                "syn_rate": flow["syn_count"] / duration, "dns_queries": list(flow["dns_queries"]),
                "inbound_bytes": 0, "outbound_bytes": 0,
            }
            try:
                await self._flow_sink(metadata, "live_passive_feed")
            except Exception:
                # Capture must continue even if analysis/database/WebSocket is degraded.
                continue


live_capture = LiveCaptureManager()
