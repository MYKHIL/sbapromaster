# License Management Portal Setup Guide

## Overview

The License Management Portal allows administrators to activate and manage school subscriptions across all Firebase databases from a single interface.

## Features

✅ **Multi-Database Support** - Fetches schools from all configured Firebase databases
✅ **Quick Templates** - Pre-configured license tiers (Trial, Basic, Standard, Premium, etc.)
✅ **Custom Parameters** - Flexible maxStudents, maxClass, and duration settings
✅ **One-Click Activation** - Activate licenses with a single click
✅ **Search & Filter** - Find schools quickly by name or ID
✅ **Real-time Feedback** - Immediate confirmation of license activation

## Files

- `d:\Projects\SBA Web Approval\license-portal.html` - Main portal interface
- `d:\Projects\SBA Pro Master - Web\scripts\run_license_portal.py` - Local test server
- `d:\Projects\SBA Pro Master - Web\docs\LICENSE_PORTAL_SETUP.md` - This guide

## Local Testing

### Prerequisites

- Python 3.7+
- Web browser (Chrome/Firefox recommended)
- Network access to Firebase

### Step 1: Update Firebase Configurations

Edit `license-portal.html` (located in `d:\Projects\SBA Web Approval\`) and replace the `FIREBASE_CONFIGS` object with your actual Firebase project configurations:

```javascript
const FIREBASE_CONFIGS = {
    1: {
        apiKey: "YOUR_API_KEY",
        authDomain: "YOUR_PROJECT.firebaseapp.com",
        projectId: "YOUR_PROJECT_ID",
        // ... rest of config
    },
    // Add more databases as needed
};
```

### Step 2: Start Local Server

```bash
cd "d:\Projects\SBA Pro Master - Web"
python scripts/run_license_portal.py
```

The server will start on `http://localhost:8000`

### Step 3: Open Portal

Navigate to: `http://localhost:8000/license-portal.html`

### Step 4: Test License Activation

1. Wait for schools to load (fetched from all databases)
2. Use the search box to find a school
3. Click on a school to select it
4. Choose a license template OR enter custom parameters
5. Click "Activate License"
6. Verify the subscription was created in Firebase Console

## Production Deployment

### Option 1: Firebase Hosting

1. **Install Firebase CLI**:
   ```bash
   npm install -g firebase-tools
   firebase login
   ```

2. **Initialize Hosting**:
   ```bash
   firebase init hosting
   # Select your project
   # Set public directory to: admin
   # Configure as single-page app: No
   ```

3. **Deploy**:
   ```bash
   firebase deploy --only hosting
   ```

4. **Access**: Visit your Firebase hosting URL

### Option 2: GitHub Pages

1. Create a new repository (e.g., `sba-license-portal`)
2. Copy `admin/license-portal.html` to root as `index.html`
3. Update Firebase configs in the file
4. Push to GitHub
5. Enable GitHub Pages in repository settings
6. Access at `https://yourusername.github.io/sba-license-portal`

### Option 3: Custom Web Server

1. Copy `admin/license-portal.html` to your web server
2. Configure HTTPS (required for Firebase)
3. Set appropriate CORS headers
4. Restrict access with authentication (e.g., htpasswd, OAuth)

## Security Considerations

⚠️ **IMPORTANT**: This portal has full write access to subscription data

### Recommended Security Measures:

1. **Authentication**: Implement admin authentication
   - Use Firebase Authentication
   - Add password protection
   - Implement IP whitelisting

2. **HTTPS Only**: Always use HTTPS in production

3. **Access Control**: 
   - Limit who can access the portal
   - Use VPN or private network
   - Implement audit logging

4. **Firebase Security Rules**: 
   - Restrict `/subscriptions` collection writes
   - Consider using Firebase Admin SDK instead
   - Add server-side validation

### Implementing Basic Auth (htpasswd)

For Apache/Nginx servers:

```nginx
location /license-portal.html {
    auth_basic "Admin Portal";
    auth_basic_user_file /etc/nginx/.htpasswd;
}
```

## Customization

### Adding License Templates

Edit the `LICENSE_TEMPLATES` array in `license-portal.html`:

```javascript
const LICENSE_TEMPLATES = [
    {
        name: 'My Custom Plan',
        maxStudents: 750,maxClass: 30,
        months: 6,
        price: 'GHS 1,500'
    },
    // ... more templates
];
```

### Styling

The portal uses Tailwind CSS. Modify classes directly in the HTML or add custom CSS:

```html
<style>
    /* Custom styles here */
    .school-item:hover {
        transform: translateY(-2px);
    }
</style>
```

### Branding

Replace the header logo and title:

```html
<header class="text-center mb-12">
    <img src="your-logo.png" alt="Logo" class="mx-auto mb-4" />
    <h1>Your Organization Name</h1>
</header>
```

## Troubleshooting

### Schools not loading

**Cause**: Firebase configuration error or network issue

**Solution**:
1. Check browser console for errors
2. Verify Firebase configs are correct
3. Ensure Firestore rules allow reads
4. Check network connectivity

### "Permission denied" when activating

**Cause**: Firestore security rules blocking writes

**Solution**:
1. Check Firestore rules allow writes to `/subscriptions/{schoolId}`
2. Ensure authenticated (if using Firebase Auth)
3. Verify database index is correct

### Server won't start (port in use)

**Cause**: Port 8000 already occupied

**Solution**:
```bash
# Change port in run_license_portal.py
PORT = 8001  # or any available port
```

## License Templates Reference

| Template | Max Students | Max Classes | Duration | Price |
|----------|-------------|-------------|----------|-------|
| Trial | 10 | 1 | 1 month | Free |
| Basic | 50 | 5 | 12 months | GHS 200 |
| Standard | 200 | 10 | 12 months | GHS 500 |
| Premium | 500 | 20 | 12 months | GHS 1,000 |
| Professional | 1,000 | 50 | 12 months | GHS 2,000 |
| Enterprise | 5,000 | 200 | 12 months | GHS 5,000 |
| Custom | Flexible | Flexible | Flexible | Contact |

## Support

For issues or questions:
- Check browser console for error messages
- Verify Firebase Console for subscription data
- Review server logs for Python errors
- Contact developer: (+233) 0542410613
