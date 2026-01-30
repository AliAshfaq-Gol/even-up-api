#!/bin/bash

# API Test Script for Splitwise Clone Backend
# Base URL
BASE_URL="http://localhost:8044"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Splitwise Clone API Test Script ===${NC}\n"

# Step 1: Login
echo -e "${YELLOW}1. Logging in...${NC}"
LOGIN_RESPONSE=$(curl -s --location "${BASE_URL}/api/auth/login" \
--header 'Content-Type: application/json' \
--data-raw '{
    "email": "testuser2@gmail.com",
    "password": "123456"
}')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo -e "${RED}Login failed. Please check credentials.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Login successful${NC}"
echo -e "Token: ${TOKEN:0:50}...\n"

# Step 2: Get Friends
echo -e "${YELLOW}2. Getting friends list...${NC}"
curl -s --location "${BASE_URL}/api/friends" \
--header "Authorization: Bearer $TOKEN" | jq '.'
echo -e "\n"

# Step 3: Add Friend (Example - replace with actual phone number)
echo -e "${YELLOW}3. Adding friend...${NC}"
curl -s --location "${BASE_URL}/api/friends/add" \
--header 'Content-Type: application/json' \
--header "Authorization: Bearer $TOKEN" \
--data-raw '{
    "phone_number": "03451234567"
}' | jq '.'
echo -e "\n"

# Step 4: Create Group
echo -e "${YELLOW}4. Creating group...${NC}"
GROUP_RESPONSE=$(curl -s --location "${BASE_URL}/api/groups" \
--header 'Content-Type: application/json' \
--header "Authorization: Bearer $TOKEN" \
--data-raw '{
    "name": "Test Group",
    "description": "API Testing Group",
    "members": []
}')

GROUP_ID=$(echo $GROUP_RESPONSE | grep -o '"group_id":"[^"]*' | cut -d'"' -f4)
echo -e "${GREEN}✓ Group created${NC}"
echo -e "Group ID: $GROUP_ID\n"

# Step 5: Get Groups
echo -e "${YELLOW}5. Getting user groups...${NC}"
curl -s --location "${BASE_URL}/api/groups" \
--header "Authorization: Bearer $TOKEN" | jq '.'
echo -e "\n"

# Step 6: Create Expense
if [ ! -z "$GROUP_ID" ]; then
    echo -e "${YELLOW}6. Creating expense...${NC}"
    EXPENSE_RESPONSE=$(curl -s --location "${BASE_URL}/api/expenses" \
    --header 'Content-Type: application/json' \
    --header "Authorization: Bearer $TOKEN" \
    --data-raw "{
        \"group_id\": \"$GROUP_ID\",
        \"amount\": 1500.50,
        \"description\": \"Test Expense\",
        \"category\": \"Food\"
    }")
    
    echo "$EXPENSE_RESPONSE" | jq '.'
    echo -e "\n"
    
    # Step 7: Get Group Expenses
    echo -e "${YELLOW}7. Getting group expenses...${NC}"
    curl -s --location "${BASE_URL}/api/expenses/group/$GROUP_ID" \
    --header "Authorization: Bearer $TOKEN" | jq '.'
    echo -e "\n"
    
    # Step 8: Calculate Balances
    echo -e "${YELLOW}8. Calculating balances...${NC}"
    curl -s --location --request POST "${BASE_URL}/api/balances/group/$GROUP_ID/calculate" \
    --header "Authorization: Bearer $TOKEN" | jq '.'
    echo -e "\n"
    
    # Step 9: Get Balances
    echo -e "${YELLOW}9. Getting balances...${NC}"
    curl -s --location "${BASE_URL}/api/balances/group/$GROUP_ID" \
    --header "Authorization: Bearer $TOKEN" | jq '.'
    echo -e "\n"
    
    # Step 10: Get Settlements
    echo -e "${YELLOW}10. Getting settlements...${NC}"
    curl -s --location "${BASE_URL}/api/balances/group/$GROUP_ID/settlements" \
    --header "Authorization: Bearer $TOKEN" | jq '.'
    echo -e "\n"
fi

echo -e "${GREEN}=== Test Complete ===${NC}"
