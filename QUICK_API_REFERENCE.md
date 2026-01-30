# Quick API Reference

**Base URL:** `http://localhost:8044`  
**Auth Header:** `Authorization: Bearer {TOKEN}`

---

## 🔐 Authentication

**Login** → Get token
```bash
POST /api/auth/login
Body: { "email": "...", "password": "..." }
```

**Signup** → Create account
```bash
POST /api/auth/signup
Body: { "full_name", "email", "phone_number", "password", "timezone", "currency" }
```

---

## 👥 Friends

**Add Friend** (single or multiple)
```bash
POST /api/friends/add
Body: { "phone_number": "..." } OR { "contact_list": ["...", "..."] }
```

**List Friends**
```bash
GET /api/friends
```

**Remove Friend**
```bash
DELETE /api/friends/:friend_id
```

---

## 👨‍👩‍👧‍👦 Groups

**Create Group**
```bash
POST /api/groups
Body: { "name": "...", "description": "...", "members": ["id1", "id2"] }
```

**List My Groups**
```bash
GET /api/groups
```

**Get Group Details**
```bash
GET /api/groups/:group_id
```

**Add Members**
```bash
POST /api/groups/:group_id/members
Body: { "member_ids": ["id1", "id2"] }
```

**Remove Member**
```bash
DELETE /api/groups/:group_id/members/:member_id
```

---

## 💰 Expenses

**Create Expense**
```bash
POST /api/expenses
Body: {
  "group_id": "...",
  "amount": 1000.50,
  "description": "...",
  "category": "...",
  "participants": ["id1", "id2"] // optional
}
```

**Get Group Expenses**
```bash
GET /api/expenses/group/:group_id
```

**Get Expense Details**
```bash
GET /api/expenses/:expense_id
```

---

## ⚖️ Balances

**Calculate Balances** (auto-called on expense creation)
```bash
POST /api/balances/group/:group_id/calculate
```

**Get Balances**
```bash
GET /api/balances/group/:group_id
Response: { "all_balances": [...], "your_balances": { "you_owe": [...], "owes_you": [...] } }
```

**Settle Balance**
```bash
POST /api/balances/group/:group_id/settle
Body: { "payee_id": "...", "amount": 500.00 }
```

**Get Settlements**
```bash
GET /api/balances/group/:group_id/settlements
```

---

## 📝 Example Flow

1. **Login** → Save token
2. **Add Friends** → Get friend user_ids
3. **Create Group** → Save group_id
4. **Add Expenses** → Auto-calculates balances
5. **Check Balances** → See who owes what
6. **Settle Up** → Mark as paid
