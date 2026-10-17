#!/bin/bash
# Test end-to-end del flusso di promozione Dirigente → Admin → Dichiarazione LR
#
# 1. Registra una società nuova (dirigente incaricato auto-admin)
# 2. Dirigente incaricato dichiara "authorized_delegate"
# 3. Un dirigente si registra (status pending)
# 4. Dirigente incaricato lo approva
# 5. Dirigente incaricato lo promuove ad admin (PATCH /users/{id}/role)
# 6. Il neo-admin logga e chiama /admin/primary-admin/status
# 7. Verifica che should_show_declaration_popup = true (non c'è LR)
# 8. Neo-admin dichiara "legal_representative"
# 9. Verifica scettro: lui prende il primary, vecchio admin può rimettere

set -e
API="https://zaino-coach-hub.preview.emergentagent.com/api"
RND=$RANDOM

INST_EMAIL="testinst-${RND}@example.com"
ADMIN_EMAIL="admin-${RND}@example.com"
LR_EMAIL="lr-${RND}@example.com"

echo "============================================================"
echo "STEP 1: register-society (Dirigente Incaricato auto-admin)"
echo "============================================================"
RES=$(curl -s -X POST "$API/auth/register-society" -H "Content-Type: application/json" -d "{
  \"society_name\": \"Test Society SSD\",
  \"society_fiscal_code\": \"01234567890\",
  \"society_address\": \"Via Roma 1\",
  \"society_email\": \"$INST_EMAIL\",
  \"admin_email\": \"$ADMIN_EMAIL\",
  \"admin_password\": \"Password123!\",
  \"admin_first_name\": \"Mario\",
  \"admin_last_name\": \"Rossi\",
  \"admin_fiscal_code\": \"RSSMRA80A01H501Z\",
  \"admin_phone\": \"3331234567\",
  \"accept_terms\": true,
  \"accept_privacy\": true,
  \"accept_authorization\": true
}")
ADMIN_TOKEN=$(echo "$RES" | python3 -c "import sys,json;print(json.load(sys.stdin).get('token',''))")
SOCIETY_ID=$(echo "$RES" | python3 -c "import sys,json;print(json.load(sys.stdin).get('user',{}).get('society_id',''))")
ADMIN_ID=$(echo "$RES" | python3 -c "import sys,json;print(json.load(sys.stdin).get('user',{}).get('id',''))")
echo "ADMIN_TOKEN=${ADMIN_TOKEN:0:20}..."
echo "SOCIETY_ID=$SOCIETY_ID"
echo "ADMIN_ID=$ADMIN_ID"

# Get invite code
INVITE=$(curl -s -X GET "$API/societies/invite-code" -H "Authorization: Bearer $ADMIN_TOKEN" | python3 -c "import sys,json;print(json.load(sys.stdin).get('invite_code',''))")
echo "INVITE_CODE=$INVITE"

echo ""
echo "============================================================"
echo "STEP 2: Dirigente Incaricato firma 'authorized_delegate'"
echo "============================================================"
DECL_RES=$(curl -s -X POST "$API/admin/primary-admin/declare" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d '{"declaration_type": "authorized_delegate", "confirmed": true}')
echo "$DECL_RES"

echo ""
echo "============================================================"
echo "STEP 3: Future LR si registra come Dirigente (status pending)"
echo "============================================================"
LR_REG=$(curl -s -X POST "$API/auth/register" -H "Content-Type: application/json" -d "{
  \"email\": \"$LR_EMAIL\",
  \"password\": \"Password123!\",
  \"role\": \"viewer\",
  \"full_name\": \"Giuseppe Verdi\",
  \"first_name\": \"Giuseppe\",
  \"last_name\": \"Verdi\",
  \"fiscal_code\": \"VRDGPP70A01H501Z\",
  \"phone\": \"3339876543\",
  \"invite_code\": \"$INVITE\"
}")
LR_TOKEN_INITIAL=$(echo "$LR_REG" | python3 -c "import sys,json;print(json.load(sys.stdin).get('token',''))")
LR_ID=$(echo "$LR_REG" | python3 -c "import sys,json;print(json.load(sys.stdin).get('user',{}).get('id',''))")
LR_STATUS=$(echo "$LR_REG" | python3 -c "import sys,json;print(json.load(sys.stdin).get('user',{}).get('status',''))")
echo "LR_ID=$LR_ID"
echo "LR_STATUS=$LR_STATUS  (atteso: pending)"

echo ""
echo "============================================================"
echo "STEP 4: Dirigente Incaricato approva il dirigente"
echo "============================================================"
APPROVE_RES=$(curl -s -X PATCH "$API/users/$LR_ID/status" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d '{"status": "approved"}')
echo "$APPROVE_RES"

echo ""
echo "============================================================"
echo "STEP 5: Dirigente Incaricato promuove ad ADMIN"
echo "============================================================"
PROMOTE_RES=$(curl -s -X PATCH "$API/users/$LR_ID/role" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d '{"role": "admin"}')
echo "$PROMOTE_RES"

echo ""
echo "============================================================"
echo "STEP 6: Il neo-admin si rilogga e ricontrolla status"
echo "============================================================"
LR_LOGIN=$(curl -s -X POST "$API/auth/login" -H "Content-Type: application/json" -d "{\"email\":\"$LR_EMAIL\",\"password\":\"Password123!\"}")
LR_TOKEN=$(echo "$LR_LOGIN" | python3 -c "import sys,json;print(json.load(sys.stdin).get('token',''))")
LR_ROLE=$(echo "$LR_LOGIN" | python3 -c "import sys,json;print(json.load(sys.stdin).get('user',{}).get('role',''))")
echo "LR_ROLE=$LR_ROLE  (atteso: admin)"

echo ""
echo "============================================================"
echo "STEP 7: Verifica should_show_declaration_popup per neo-admin"
echo "============================================================"
LR_STATUS_RES=$(curl -s -X GET "$API/admin/primary-admin/status" -H "Authorization: Bearer $LR_TOKEN")
echo "$LR_STATUS_RES" | python3 -m json.tool

echo ""
echo "============================================================"
echo "STEP 8: Neo-admin firma 'legal_representative'"
echo "============================================================"
LR_DECL=$(curl -s -X POST "$API/admin/primary-admin/declare" -H "Authorization: Bearer $LR_TOKEN" -H "Content-Type: application/json" -d '{"declaration_type":"legal_representative", "confirmed": true, "legal_representative_person_name": "Giuseppe Verdi"}')
echo "$LR_DECL"

echo ""
echo "============================================================"
echo "STEP 9: Verifica finale - vecchio admin (delegate) vede LR"
echo "============================================================"
FINAL=$(curl -s -X GET "$API/admin/primary-admin/status" -H "Authorization: Bearer $ADMIN_TOKEN")
echo "$FINAL" | python3 -m json.tool

# Cleanup: rimuovi società di test
echo ""
echo "============================================================"
echo "CLEANUP"
echo "============================================================"
cd /app/backend && set -a && . ./.env && set +a && python3 -c "
import asyncio, os
from motor.motor_asyncio import AsyncIOMotorClient
async def cleanup():
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = client[os.environ['DB_NAME']]
    sid = '$SOCIETY_ID'
    r1 = await db.users.delete_many({'society_id': sid})
    r2 = await db.societies.delete_one({'id': sid})
    r3 = await db.settings.delete_many({'society_id': sid})
    r4 = await db.notifications.delete_many({'data.user_id': {'\$in': ['$LR_ID']}})
    print(f'cleanup: users={r1.deleted_count} society={r2.deleted_count} settings={r3.deleted_count} notif={r4.deleted_count}')
asyncio.run(cleanup())
"
