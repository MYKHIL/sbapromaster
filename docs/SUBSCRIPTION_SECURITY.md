# Subscription Security Model

## ⚠️ IMPORTANT: Client-Side Limitation

The current implementation uses a **client-side secret key** approach to restrict subscription writes. This is **NOT truly secure** because:

1. The secret key is embedded in the HTML file (visible in browser dev tools)
2. Anyone with the key can write to subscriptions
3. Firestore Security Rules cannot distinguish between different web applications

## Current Implementation

### How It Works

1. **Firestore Rules** require an `adminSecret` field in subscription writes
2. **License Portal** includes the correct secret when activating licenses
3. **Main App** cannot write to subscriptions (doesn't have the secret)

### Secret Key

```
SBA_ADMIN_PORTAL_SECRET_2025
```

**Location:** 
- `firestore.rules` - line 22
- `license-portal.html` - line 197

## Security Recommendations

### For Local Testing
✅ Current approach is acceptable
✅ Access control via file system permissions
✅ No public internet exposure

### For Production Deployment

⚠️ **CRITICAL**: Do NOT use the client-side approach in production!

#### Recommended Solution: Backend API

**Architecture:**
```
License Portal (Frontend)
    ↓ (HTTPS Request)
Backend Server (Node.js/Python)
    ↓ (Firebase Admin SDK)
Firestore Database
```

**Implementation Steps:**

1. **Create Backend API** (e.g., using Express.js or Flask)
   ```javascript
   // Example: Node.js with Express + Firebase Admin
   const admin = require('firebase-admin');
   const express = require('express');
   
   admin.initializeApp({
     credential: admin.credential.cert(serviceAccount)
   });
   
   app.post('/api/activate-license', async (req, res) => {
     // Verify admin authentication (e.g., JWT token)
     // Validate request data
     // Write to Firestore using Admin SDK
     await admin.firestore()
       .collection('subscriptions')
       .doc(schoolId)
       .set(subscriptionData);
   });
   ```

2. **Update Firestore Rules**
   ```javascript
   match /subscriptions/{schoolId} {
     // Read for app to check limits
     allow read: if request.auth != null 
       && request.time < resource.data.expiryDate;
     
     // Write ONLY via Admin SDK (no client writes allowed)
     allow write: if false;
   }
   ```

3. **Update License Portal**
   - Remove direct Firestore writes
   - Call backend API instead
   - Add admin authentication (OAuth, JWT, etc.)

4. **Deploy Backend**
   - Cloud Functions (Firebase/Google Cloud)
   - Heroku
   - AWS Lambda
   - Your own server

### Alternative: Firebase App Check

Use Firebase App Check to verify requests come from legitimate apps:

```javascript
match /subscriptions/{schoolId} {
  allow write: if request.auth != null 
    && request.app.check.token != null // Requires App Check
    && /* additional validation */;
}
```

## Migration Path

### Phase 1: Current (Local Testing)
- ✅ Client-side with secret key
- ✅ File system access control
- ✅ No internet exposure

### Phase 2: Production (Recommended)
1. Create backend API
2. Implement authentication (admin users only)
3. Update Firestore rules to block all client writes
4. Update portal to call API instead of Firestore
5. Deploy backend securely

### Phase 3: Enhanced Security
1. Add audit logging
2. Implement role-based access control (RBAC)
3. Add rate limiting
4. Set up monitoring and alerts

## Code Examples

### Backend API (Node.js + Express)

```bash
npm install express firebase-admin cors
```

```javascript
// server.js
const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');

const serviceAccount = require('./service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const app = express();
app.use(cors());
app.use(express.json());

// Simple API key authentication (improve for production)
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'your-secure-api-key';

app.post('/api/activate-license', async (req, res) => {
  // Verify API key
  if (req.headers['x-api-key'] !== ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { schoolId, maxStudents, maxClass, months, dbIndex } = req.body;

  // Validate data
  if (!schoolId || !maxStudents || !maxClass || !months) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + months);

    const subscriptionData = {
      maxStudents,
      maxClass,
      expiryDate: admin.firestore.Timestamp.fromDate(expiryDate),
      activatedAt: admin.firestore.Timestamp.now(),
      activatedBy: 'Admin API',
      apiVersion: '1.0'
    };

    // Write using Admin SDK (bypasses security rules)
    await admin.firestore()
      .collection('subscriptions')
      .doc(schoolId)
      .set(subscriptionData);

    res.json({ success: true, message: 'License activated' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

### Updated License Portal (Frontend)

```javascript
// Replace the activateLicense function
window.activateLicense = async function() {
  // ... validation code ...

  try {
    const response = await fetch('https://your-api.com/api/activate-license', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'your-secure-api-key' // Store securely!
      },
      body: JSON.stringify({
        schoolId: selectedSchool.id,
        maxStudents,
        maxClass,
        months,
        dbIndex: selectedSchool.dbIndex
      })
    });

    const result = await response.json();
    
    if (response.ok) {
      showMessage(`✅ ${result.message}`, 'success');
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    showMessage(`❌ Failed: ${error.message}`, 'error');
  }
};
```

## Summary

| Aspect | Current (Testing) | Recommended (Production) |
|--------|------------------|-------------------------|
| Security | Low (client-side secret) | High (backend API) |
| Complexity | Simple | Moderate |
| Cost | Free | Cloud hosting costs |
| Authentication | None | Required |
| Auditability | None | Full logging |
| Recommended For | Local development | Production deployment |

**Bottom Line:** Use the current approach for local testing only. Implement a backend API before deploying to production.
