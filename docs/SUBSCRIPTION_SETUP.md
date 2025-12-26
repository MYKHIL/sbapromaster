# Subscription-Based Access Control Setup Guide

## Overview

This system implements server-side subscription limits using Firestore Security Rules. Schools are restricted based on:
- **maxStudents**: Maximum number of students allowed
- **maxClass**: Maximum number of classes allowed
- **expiryDate**: Subscription expiration date

## Architecture

### 1. Subscriptions Collection (Admin-Only)
```
/subscriptions/{schoolId}
  - maxStudents: number
  - maxClass: number
  - expiryDate: timestamp
  - lastUpdated: timestamp
```

**Important**: This collection is **not accessible** from the web app. Only Firebase Admin SDK can read/write.

### 2. Security Rules Enforcement

The `firestore.rules` file enforces these limits:
- Reads are blocked if subscription expired
- Writes are blocked if limits exceeded
- App cannot access subscription limits directly

## Setup Instructions

### Step 1: Deploy Security Rules

1. Navigate to Firebase Console → Firestore Database → Rules
2. Copy content from `firestore.rules`
3. Paste and publish the rules

**OR** use Firebase CLI:
```bash
firebase deploy --only firestore:rules
```

### Step 2: Install Firebase Admin SDK (for managing subscriptions)

```bash
pip install firebase-admin
```

### Step 3: Get Service Account Key

1. Go to Firebase Console → Project Settings → Service Accounts
2. Click "Generate New Private Key"
3. Save the JSON file securely (e.g., `service-account-key.json`)
4. **DO NOT** commit this file to version control

### Step 4: Create Subscriptions

Run the subscription management script:

```bash
python scripts/setup_subscriptions.py
```

Follow the prompts to:
- Point to your service account JSON
- Create subscription for each school
- Set limits and expiry dates

**Example**:
```
School ID: ayirebida_2025-2026_First-Term
Max Students: 500
Max Classes: 15
Expiry: 2026-12-31
```

### Step 5: Verify Rules

Test that the rules work:

1. **Test expired subscription**: Set expiry to past date, try to access → should fail
2. **Test student limit**: Try adding students beyond `maxStudents` → should fail
3. **Test class limit**: Try adding classes beyond `maxClass` → should fail

## Managing Subscriptions

### Create New Subscription
```bash
python scripts/setup_subscriptions.py
# Select option 1
```

### List All Subscriptions
```bash
python scripts/setup_subscriptions.py
# Select option 2
```

### Update Existing Subscription
Same as creating - it will overwrite existing subscription for that school ID.

### Extend Expiry Date
Run script and update the school with new expiry date.

## Security Considerations

1. **Service Account Key**: Store securely, never commit to Git
2. **Subscription Collection**: Only accessible via Admin SDK
3. **Rule Validation**: Happens server-side, cannot be bypassed by app
4. **Performance**: Each write operation reads subscription doc (cached by Firebase)

## Troubleshooting

### "Permission denied" errors in app

**Cause**: Subscription expired or limits exceeded

**Solution**: 
1. Check subscription in Firestore Console
2. Update expiry date or increase limits
3. Use `setup_subscriptions.py` to fix

### Rules not working

**Cause**: Rules not deployed or syntax error

**Solution**:
1. Check Firebase Console → Rules tab for errors
2. Re-deploy rules
3. Wait a few minutes for propagation

### Cannot access subscription data from app

**Expected behavior** - subscriptions are admin-only. If you need to show limits in UI:
1. Create a separate readable field in school document (e.g., `displayLimits`)
2. Update via Cloud Function when subscription changes
3. Never store actual enforcement logic in app-accessible fields

## Migration from Current System

If you currently store these fields in school documents:

1. **Extract subscription data**:
   ```javascript
   const schools = await db.collection('schools').get();
   schools.forEach(school => {
     const { maxStudents, maxClass, expiryDate } = school.data();
     // Create subscription doc with this data
   });
   ```

2. **Remove from school docs**:
   ```javascript
   await school.ref.update({
     maxStudents: firebase.firestore.FieldValue.delete(),
     maxClass: firebase.firestore.FieldValue.delete(),
     expiryDate: firebase.firestore.FieldValue.delete()
   });
   ```

3. **Deploy new rules**

## Integration with Multi-Database Architecture

Each Firebase project should have its own `/subscriptions` collection. When a school is assigned to a database, create its subscription in that database's Firestore instance.

**Example**:
- School on Database 1 → Subscription in Database 1
- School on Database 2 → Subscription in Database 2
