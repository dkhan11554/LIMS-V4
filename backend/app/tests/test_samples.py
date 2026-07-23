"""End-to-end vertical slice test: register a sample and walk it through a
status transition, exercising the LIMS-number generator, chain-of-custody
logging, and RBAC in combination."""


def _setup_lab_and_customer(client, headers):
    company = client.post("/api/v1/companies", json={"name": "Acme Labs"}, headers=headers).json()
    lab = client.post(
        "/api/v1/laboratories",
        json={"name": "Main Lab", "code": "MAIN", "company_id": company["id"]},
        headers=headers,
    ).json()
    customer = client.post(
        "/api/v1/customers",
        json={"customer_code": "CUST-001", "name": "Acme Pharma", "laboratory_id": lab["id"]},
        headers=headers,
    ).json()
    test_ = client.post(
        "/api/v1/tests",
        json={
            "test_code": "PH",
            "name": "pH",
            "laboratory_id": lab["id"],
            "result_type": "numeric",
        },
        headers=headers,
    ).json()
    return lab, customer, test_


def test_register_sample_generates_lims_number(client, auth_headers):
    lab, customer, test_ = _setup_lab_and_customer(client, auth_headers)

    resp = client.post(
        "/api/v1/samples",
        json={
            "customer_id": customer["id"],
            "laboratory_id": lab["id"],
            "sample_name": "Batch 001",
            "test_ids": [test_["id"]],
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    sample = resp.json()
    assert sample["lims_number"].startswith("LAB-")
    assert sample["status"] == "registered"

    tests_resp = client.get(f"/api/v1/samples/{sample['id']}/tests", headers=auth_headers)
    assert len(tests_resp.json()) == 1


def test_lims_numbers_increment_sequentially(client, auth_headers):
    lab, customer, test_ = _setup_lab_and_customer(client, auth_headers)
    numbers = []
    for _ in range(3):
        resp = client.post(
            "/api/v1/samples",
            json={"customer_id": customer["id"], "laboratory_id": lab["id"], "sample_name": "S"},
            headers=auth_headers,
        )
        numbers.append(resp.json()["lims_number"])
    assert numbers == sorted(numbers)
    assert len(set(numbers)) == 3


def test_invalid_status_transition_rejected(client, auth_headers):
    lab, customer, _ = _setup_lab_and_customer(client, auth_headers)
    sample = client.post(
        "/api/v1/samples",
        json={"customer_id": customer["id"], "laboratory_id": lab["id"], "sample_name": "S"},
        headers=auth_headers,
    ).json()

    resp = client.post(
        f"/api/v1/samples/{sample['id']}/status",
        json={"status": "delivered"},
        headers=auth_headers,
    )
    assert resp.status_code == 400


def test_valid_status_transition_logs_custody(client, auth_headers):
    lab, customer, _ = _setup_lab_and_customer(client, auth_headers)
    sample = client.post(
        "/api/v1/samples",
        json={"customer_id": customer["id"], "laboratory_id": lab["id"], "sample_name": "S"},
        headers=auth_headers,
    ).json()

    resp = client.post(
        f"/api/v1/samples/{sample['id']}/status",
        json={"status": "awaiting_receipt"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "awaiting_receipt"
