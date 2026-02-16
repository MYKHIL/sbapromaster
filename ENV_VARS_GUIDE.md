# Environment Variables Configuration Guide

This guide explains how to configure Firebase databases and school mappings in Vercel without requiring code changes.

## Current Configuration

### Database 1 (Primary)
```
FIREBASE_1_API_KEY=<your-api-key>
FIREBASE_1_AUTH_DOMAIN=<your-auth-domain>
FIREBASE_1_PROJECT_ID=<your-project-id>
FIREBASE_1_STORAGE_BUCKET=<your-storage-bucket>
FIREBASE_1_MESSAGING_SENDER_ID=<your-sender-id>
FIREBASE_1_APP_ID=<your-app-id>
FIREBASE_1_MEASUREMENT_ID=<your-measurement-id>
FIREBASE_1_IS_RESERVED=false
FIREBASE_1_LABEL=Primary
```

### Database 2 (Reserved for Ayirebida)
```
FIREBASE_2_API_KEY=<your-api-key>
FIREBASE_2_AUTH_DOMAIN=<your-auth-domain>
FIREBASE_2_PROJECT_ID=<your-project-id>
FIREBASE_2_STORAGE_BUCKET=<your-storage-bucket>
FIREBASE_2_MESSAGING_SENDER_ID=<your-sender-id>
FIREBASE_2_APP_ID=<your-app-id>
FIREBASE_2_MEASUREMENT_ID=<your-measurement-id>
FIREBASE_2_IS_RESERVED=true
FIREBASE_2_LABEL=Reserved/Darko
```

### Database 3 (Public 2)
```
FIREBASE_3_API_KEY=<your-api-key>
FIREBASE_3_AUTH_DOMAIN=<your-auth-domain>
FIREBASE_3_PROJECT_ID=<your-project-id>
FIREBASE_3_STORAGE_BUCKET=<your-storage-bucket>
FIREBASE_3_MESSAGING_SENDER_ID=<your-sender-id>
FIREBASE_3_APP_ID=<your-app-id>
FIREBASE_3_MEASUREMENT_ID=<your-measurement-id>
FIREBASE_3_IS_RESERVED=false
FIREBASE_3_LABEL=Public 2
```

### School-to-Database Mapping
```
SCHOOL_DATABASE_MAPPING={"ayirebida":2}
```

---

## Adding a New Database

To add a 4th database, simply add these environment variables in Vercel:

```
FIREBASE_4_API_KEY=<new-api-key>
FIREBASE_4_AUTH_DOMAIN=<new-auth-domain>
FIREBASE_4_PROJECT_ID=<new-project-id>
FIREBASE_4_STORAGE_BUCKET=<new-storage-bucket>
FIREBASE_4_MESSAGING_SENDER_ID=<new-sender-id>
FIREBASE_4_APP_ID=<new-app-id>
FIREBASE_4_MEASUREMENT_ID=<new-measurement-id>
FIREBASE_4_IS_RESERVED=false
FIREBASE_4_LABEL=New Database
```

**No code changes needed!** The system will automatically detect and use the new database.

---

## Adding a School Mapping

To route a school to a specific database, update the `SCHOOL_DATABASE_MAPPING` variable:

### Example: Route "newschool" to Database 4
```
SCHOOL_DATABASE_MAPPING={"ayirebida":2,"newschool":4}
```

### Example: Route Multiple Schools
```
SCHOOL_DATABASE_MAPPING={"ayirebida":2,"newschool":4,"testschool":3}
```

**Important Notes:**
- School names should be lowercase
- School names should have no spaces or special characters
- The JSON must be valid (use double quotes)
- Database index must exist (have corresponding FIREBASE_N_* variables)

---

## Verification Steps

After adding new environment variables in Vercel:

1. **Trigger Deployment**: Push a commit or manually redeploy in Vercel dashboard
2. **Test API Endpoint**: Visit `https://sbapromaster.vercel.app/api/firebase-config`
   - Verify new database appears in `configs` object
   - Verify new school appears in `schoolDatabaseMapping` object
3. **Test App**: Login with a school that should use the new database
   - Verify it connects to the correct database

---

## Troubleshooting

### Database Not Appearing
- Ensure all `FIREBASE_N_*` variables are set (missing any will skip that index)
- Check for typos in variable names
- Verify deployment completed successfully

### School Mapping Not Working
- Verify JSON syntax in `SCHOOL_DATABASE_MAPPING`
- Ensure school name is lowercase and sanitized
- Check that the target database index exists
