# API CURL Examples

Base URL: `http://localhost:8044`

## Authentication

### 1. Signup
```bash
curl --location 'http://localhost:8044/api/auth/signup' \
--header 'Content-Type: application/json' \
--data-raw '{
    "full_name": "Test User 2",
    "email": "testuser2@gmail.com",
    "phone_number": "03456894356",
    "password": "123456",
    "timezone":"(UTC+05:00) Karachi",
    "currency": "PKR"
}'
```

### 2. Login
```bash
curl --location 'http://localhost:8044/api/auth/login' \
--header 'Content-Type: application/json' \
--data-raw '{
    "email": "testuser2@gmail.com",
    "password": "123456"
}'
```

**Response includes token:**
```json
{
    "success": true,
    "message": "Login successful",
    "data": {
        "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "user": {...}
    }
}
```

**Save the token for subsequent requests:**
```bash
TOKEN="your_jwt_token_here"
```

---

## Friends Module

### 3. Add Friend (Single Phone Number)
```bash
curl --location 'http://localhost:8044/api/friends/add' \
--header 'Content-Type: application/json' \
--header "Authorization: Bearer $TOKEN" \
--data-raw '{
    "phone_number": "03451234567"
}'
```

### 4. Add Friends (Contact List Array)
```bash
curl --location 'http://localhost:8044/api/friends/add' \
--header 'Content-Type: application/json' \
--header "Authorization: Bearer $TOKEN" \
--data-raw '{
    "contact_list": [
        "03451234567",
        "03459876543",
        "03001234567"
    ]
}'
```

### 5. Get Friends List
```bash
curl --location 'http://localhost:8044/api/friends' \
--header "Authorization: Bearer $TOKEN"
```

### 6. Remove Friend
```bash
curl --location --request DELETE 'http://localhost:8044/api/friends/FRIEND_USER_ID' \
--header "Authorization: Bearer $TOKEN"
```

---

## Groups Module

### 7. Create Group
```bash
curl --location 'http://localhost:8044/api/groups' \
--header 'Content-Type: application/json' \
--header "Authorization: Bearer $TOKEN" \
--data-raw '{
    "name": "Weekend Trip",
    "description": "Friends weekend getaway",
    "members": ["user_id_1", "user_id_2"]
}'
```

**Note:** `members` is optional. If not provided, only creator is added.

### 8. Get User's Groups
```bash
curl --location 'http://localhost:8044/api/groups' \
--header "Authorization: Bearer $TOKEN"
```

### 9. Get Group by ID
```bash
curl --location 'http://localhost:8044/api/groups/GROUP_ID' \
--header "Authorization: Bearer $TOKEN"
```

### 10. Add Members to Group
```bash
curl --location 'http://localhost:8044/api/groups/GROUP_ID/members' \
--header 'Content-Type: application/json' \
--header "Authorization: Bearer $TOKEN" \
--data-raw '{
    "member_ids": ["user_id_3", "user_id_4"]
}'
```

### 11. Remove Member from Group
```bash
curl --location --request DELETE 'http://localhost:8044/api/groups/GROUP_ID/members/MEMBER_USER_ID' \
--header "Authorization: Bearer $TOKEN"
```

---

## Expenses Module

### 12. Create Expense (All Group Members)
```bash
curl --location 'http://localhost:8044/api/expenses' \
--header 'Content-Type: application/json' \
--header "Authorization: Bearer $TOKEN" \
--data-raw '{
    "group_id": "GROUP_ID",
    "amount": 1500.50,
    "description": "Dinner at restaurant",
    "category": "Food",
    "date": "2026-01-30T19:00:00Z"
}'
```

**Note:** If `participants` not provided, expense is split among all group members.

### 13. Create Expense (Specific Participants)
```bash
curl --location 'http://localhost:8044/api/expenses' \
--header 'Content-Type: application/json' \
--header "Authorization: Bearer $TOKEN" \
--data-raw '{
    "group_id": "GROUP_ID",
    "amount": 2000.00,
    "description": "Movie tickets",
    "category": "Entertainment",
    "participants": ["user_id_1", "user_id_2", "user_id_3"]
}'
```

### 14. Get Group Expenses
```bash
curl --location 'http://localhost:8044/api/expenses/group/GROUP_ID' \
--header "Authorization: Bearer $TOKEN"
```

### 15. Get Expense by ID
```bash
curl --location 'http://localhost:8044/api/expenses/EXPENSE_ID' \
--header "Authorization: Bearer $TOKEN"
```

---

## Balances Module

### 16. Calculate Group Balances
```bash
curl --location --request POST 'http://localhost:8044/api/balances/group/GROUP_ID/calculate' \
--header "Authorization: Bearer $TOKEN"
```

**Note:** This recalculates and stores simplified balances. Also called automatically when expenses are created.

### 17. Get Group Balances
```bash
curl --location 'http://localhost:8044/api/balances/group/GROUP_ID' \
--header "Authorization: Bearer $TOKEN"
```

**Response includes:**
- `all_balances`: All balances in the group
- `your_balances`: Your specific balances (you_owe, owes_you)

### 18. Settle Balance
```bash
curl --location 'http://localhost:8044/api/balances/group/GROUP_ID/settle' \
--header 'Content-Type: application/json' \
--header "Authorization: Bearer $TOKEN" \
--data-raw '{
    "payee_id": "USER_ID_TO_PAY",
    "amount": 500.00
}'
```

**Note:** `payee_id` is the user you're paying (who owes you money).

### 19. Get Settlement History
```bash
curl --location 'http://localhost:8044/api/balances/group/GROUP_ID/settlements' \
--header "Authorization: Bearer $TOKEN"
```

---

## Complete Flow Example

### Step 1: Login and Save Token
```bash
RESPONSE=$(curl -s --location 'http://localhost:8044/api/auth/login' \
--header 'Content-Type: application/json' \
--data-raw '{
    "email": "testuser2@gmail.com",
    "password": "123456"
}')

TOKEN=$(echo $RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)
echo "Token: $TOKEN"
```

### Step 2: Add Friends
```bash
curl --location 'http://localhost:8044/api/friends/add' \
--header 'Content-Type: application/json' \
--header "Authorization: Bearer $TOKEN" \
--data-raw '{
    "contact_list": ["03451234567", "03459876543"]
}'
```

### Step 3: Create Group
```bash
curl --location 'http://localhost:8044/api/groups' \
--header 'Content-Type: application/json' \
--header "Authorization: Bearer $TOKEN" \
--data-raw '{
    "name": "House Expenses",
    "description": "Monthly house expenses",
    "members": ["friend_user_id_1", "friend_user_id_2"]
}'
```

### Step 4: Add Expense
```bash
curl --location 'http://localhost:8044/api/expenses' \
--header 'Content-Type: application/json' \
--header "Authorization: Bearer $TOKEN" \
--data-raw '{
    "group_id": "GROUP_ID_FROM_STEP_3",
    "amount": 3000.00,
    "description": "Groceries",
    "category": "Food"
}'
```

### Step 5: Check Balances
```bash
curl --location 'http://localhost:8044/api/balances/group/GROUP_ID_FROM_STEP_3' \
--header "Authorization: Bearer $TOKEN"
```

### Step 6: Settle Up
```bash
curl --location 'http://localhost:8044/api/balances/group/GROUP_ID/settle' \
--header 'Content-Type: application/json' \
--header "Authorization: Bearer $TOKEN" \
--data-raw '{
    "payee_id": "USER_ID_WHO_OWES_YOU",
    "amount": 1000.00
}'
```

---

## Response Format

All endpoints follow this format:

**Success:**
```json
{
    "success": true,
    "message": "Operation successful",
    "data": { ... }
}
```

**Error:**
```json
{
    "success": false,
    "message": "Error message here"
}
```

---

## Notes for React Native Implementation

1. **Token Storage:** Save JWT token securely (AsyncStorage/SecureStore)
2. **Headers:** Always include `Authorization: Bearer {token}` for protected routes
3. **Error Handling:** Check `success` field in response
4. **Group IDs:** Save group_id after creation for subsequent operations
5. **User IDs:** Extract user_id from login/signup response
6. **Balances:** Automatically recalculated on expense creation, but can be manually triggered
7. **Phone Numbers:** Normalized automatically (digits only, 10-15 chars)
