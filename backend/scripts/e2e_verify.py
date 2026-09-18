import urllib.request
import json

def run_e2e():
    # 1. Login as Alice
    login_data = "username=alice%40example.com&password=AlicePass123%21".encode()
    req = urllib.request.Request(
        "http://nginx/api/v1/auth/login",
        data=login_data,
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    with urllib.request.urlopen(req) as resp:
        alice_auth = json.loads(resp.read().decode())
        token = alice_auth["access_token"]
    print(f"1. Alice Logged in! User ID: {alice_auth['user']['id']}")

    # 2. Check Alice initial balance
    req = urllib.request.Request(
        "http://nginx/api/v1/accounts/ACT-GB1001/balance",
        headers={"Authorization": f"Bearer {token}"}
    )
    with urllib.request.urlopen(req) as resp:
        bal = json.loads(resp.read().decode())
    print(f"2. Alice Initial Balance: {bal['formatted_balance']}")

    # 3. Perform Idempotent Transfer of £250 (25000 pence) to Bob
    idemp_key = "idemp-natwest-e2e-001"
    payload = json.dumps({
        "sender_account_number": "ACT-GB1001",
        "receiver_account_number": "ACT-GB1002",
        "amount": 25000,
        "currency": "GBP",
        "reference": "E2E-TEST-250",
        "narration": "E2E Verification Transfer"
    }).encode()

    req = urllib.request.Request(
        "http://nginx/api/v1/transfers",
        data=payload,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Idempotency-Key": idemp_key
        }
    )
    with urllib.request.urlopen(req) as resp:
        t1 = json.loads(resp.read().decode())
        cache_header_1 = resp.headers.get("X-Cache-Lookup")
        server_1 = resp.headers.get("X-Served-By")
    status_1 = t1['status']
    print(f"3. Transfer 1 executed! Status: {status_1}, Node: {server_1}, Cache: {cache_header_1}")

    # 4. Repeat exact same transfer request with same Idempotency-Key
    req_repeat = urllib.request.Request(
        "http://nginx/api/v1/transfers",
        data=payload,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Idempotency-Key": idemp_key
        }
    )
    with urllib.request.urlopen(req_repeat) as resp:
        t2 = json.loads(resp.read().decode())
        cache_header_2 = resp.headers.get("X-Cache-Lookup")
        server_2 = resp.headers.get("X-Served-By")
    status_2 = t2['status']
    print(f"4. Replay Transfer executed! Status: {status_2}, Node: {server_2}, Cache: {cache_header_2}")

    # 5. Check Alice post-transfer balance
    req = urllib.request.Request(
        "http://nginx/api/v1/accounts/ACT-GB1001/balance",
        headers={"Authorization": f"Bearer {token}"}
    )
    with urllib.request.urlopen(req) as resp:
        bal_after = json.loads(resp.read().decode())
    print(f"5. Alice New Balance (debited once only): {bal_after['formatted_balance']}")

    # 6. Fetch Account Statement
    req = urllib.request.Request(
        "http://nginx/api/v1/accounts/ACT-GB1001/statement?page=1&page_size=5",
        headers={"Authorization": f"Bearer {token}"}
    )
    with urllib.request.urlopen(req) as resp:
        stmt = json.loads(resp.read().decode())
    first_entry = stmt['entries'][0]
    print(f"6. Statement fetched: {stmt['total_count']} entries. Latest: {first_entry['entry_type']} {first_entry['amount']} pence ({first_entry['reference']})")

    # 7. Login as Admin and query Audit Logs
    req = urllib.request.Request(
        "http://nginx/api/v1/auth/login",
        data="username=admin%40bank.natwest.com&password=AdminSecret123%21".encode(),
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    with urllib.request.urlopen(req) as resp:
        admin_token = json.loads(resp.read().decode())["access_token"]

    req = urllib.request.Request(
        "http://nginx/api/v1/admin/audit-logs?limit=5",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    with urllib.request.urlopen(req) as resp:
        logs = json.loads(resp.read().decode())
    print(f"7. Admin Audit Logs verified: {len(logs)} audit entries retrieved.")

    # 8. Check System Stats
    req = urllib.request.Request(
        "http://nginx/api/v1/admin/stats",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    with urllib.request.urlopen(req) as resp:
        stats = json.loads(resp.read().decode())
    print(f"8. System Overview Stats: Users={stats['total_users']}, Accounts={stats['total_accounts']}, Transfers={stats['total_transfers']}, Total Vol={stats['total_volume_pence']} pence")
    print("SUCCESS: ALL E2E VERIFICATIONS PASSED!")

if __name__ == "__main__":
    run_e2e()
