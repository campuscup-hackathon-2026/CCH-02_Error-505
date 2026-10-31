from app.services.unidirectional.engine import PassiveTrafficEngine, dga_score, entropy

def test_entropy_and_dga_score():
    assert entropy("aaaa") == 0
    assert dga_score("x7k29asd91kqz8vn4m2.example.com") >= .65

def test_all_required_demo_categories_are_detected():
    engine = PassiveTrafficEngine()
    expected = {"syn_flood": "SYN_FLOOD", "udp_amplification": "UDP_AMPLIFICATION", "c2": "C2_BEACON", "dga": "DGA", "dns_tunnel": "DNS_TUNNEL", "tls_malware": "ENCRYPTED_SESSION_ANOMALY", "port_scan": "RECONNAISSANCE", "exfiltration": "DATA_EXFILTRATION"}
    for scenario, classification in expected.items():
        found = {item["class"] for item in engine.detect(engine._flow_for_test(scenario))}
        assert classification in found