#!/usr/bin/env python3
"""Send a prompt to the deployed agent and print the FULL reply + recommended cards (for quality eval)."""
import json, subprocess, sys
PROMPT = sys.argv[1]
BASE = "https://mtg-agent-sand.vercel.app/_eve_internal/eve/eve/v1"
API = "https://api.clerk.com/v1"
def sh(c): return subprocess.check_output(c, shell=True, text=True).strip()
SK = sh("grep '^CLERK_SECRET_KEY=' .env.local | cut -d= -f2-")
def clerk(path, body=None):
    args = ["curl","-s",f"{API}{path}","-H",f"Authorization: Bearer {SK}","-H","Content-Type: application/json"]
    if body is not None: args += ["-X","POST","-d",json.dumps(body)]
    return json.loads(subprocess.check_output(args, text=True))
res = clerk("/users", {"email_address":["quality@example.com"],"password":"X9k2mPq7wLz4!vTn"})
u = res.get("id") or clerk("/users?email_address=quality@example.com")[0]["id"]
sid = clerk("/sessions", {"user_id": u})["id"]
jwt = clerk(f"/sessions/{sid}/tokens", {"expires_in_seconds": 900})["jwt"]
import re
post = subprocess.check_output(["curl","-s","-X","POST",f"{BASE}/session","-H","content-type: application/json","-H",f"authorization: Bearer {jwt}","-d",json.dumps({"message":PROMPT})], text=True)
run = re.search(r"wrun_[A-Z0-9]+", post).group(0)
out = subprocess.run(["curl","-sN","--max-time","120",f"{BASE}/session/{run}/stream","-H",f"authorization: Bearer {jwt}"], capture_output=True, text=True).stdout
text=""; cards=None
for line in out.splitlines():
    line=line.strip()
    if not line: continue
    try: e=json.loads(line)
    except: continue
    t=e.get("type"); d=e.get("data",{})
    if t=="message.appended": text=d.get("messageSoFar",text)
    if t=="action.result":
        def find(o):
            if isinstance(o,dict):
                if "cards" in o and isinstance(o["cards"],list): return o
                for v in o.values():
                    r=find(v)
                    if r: return r
            return None
        r=find(d)
        if r and any("reason" in (c or {}) for c in r["cards"]): cards=r
print("Q:", PROMPT)
print("="*70)
print(text)
if cards:
    print("-"*70); print("CARDS PRESENTED:")
    for c in cards["cards"]:
        pr = f"${c['priceUsd']}" if c.get("priceUsd") is not None else "?"
        print(f"  • {c.get('name')}  [{c.get('role')}] {pr} — {c.get('reason')}")
subprocess.run(["curl","-s","-X","DELETE",f"{API}/users/{u}","-H",f"Authorization: Bearer {SK}"], capture_output=True)
