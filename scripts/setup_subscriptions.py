#!/usr/bin/env python3
"""
Subscription Setup Script
Creates or updates subscription limits for schools in Firestore
Requires Firebase Admin SDK
"""

import sys
from datetime import datetime, timedelta

try:
    import firebase_admin
    from firebase_admin import credentials, firestore
except ImportError:
    print("❌ Firebase Admin SDK not installed")
    print("Install with: pip install firebase-admin")
    sys.exit(1)

def initialize_firebase(service_account_path):
    """Initialize Firebase Admin SDK."""
    try:
        cred = credentials.Certificate(service_account_path)
        firebase_admin.initialize_app(cred)
        return firestore.client()
    except Exception as e:
        print(f"❌ Failed to initialize Firebase: {e}")
        sys.exit(1)

def create_subscription(db, school_id, max_students, max_classes, expiry_date):
    """Create or update subscription limits for a school."""
    try:
        subscription_data = {
            'maxStudents': max_students,
            'maxClass': max_classes,
            'expiryDate': expiry_date,
            'lastUpdated': firestore.SERVER_TIMESTAMP
        }
        
        db.collection('subscriptions').document(school_id).set(subscription_data)
        print(f"✅ Subscription created for {school_id}")
        print(f"   Max Students: {max_students}")
        print(f"   Max Classes: {max_classes}")
        print(f"   Expiry: {expiry_date}")
        
    except Exception as e:
        print(f"❌ Failed to create subscription: {e}")
        return False
    
    return True

def list_subscriptions(db):
    """List all existing subscriptions."""
    try:
        subscriptions = db.collection('subscriptions').stream()
        print("\n📋 Existing Subscriptions:")
        print("-" * 80)
        
        for sub in subscriptions:
            data = sub.to_dict()
            print(f"School ID: {sub.id}")
            print(f"  Max Students: {data.get('maxStudents', 'N/A')}")
            print(f"  Max Classes: {data.get('maxClass', 'N/A')}")
            print(f"  Expiry: {data.get('expiryDate', 'N/A')}")
            print(f"  Last Updated: {data.get('lastUpdated', 'N/A')}")
            print("-" * 80)
            
    except Exception as e:
        print(f"❌ Failed to list subscriptions: {e}")

def main():
    print("=" * 80)
    print("Firebase Subscription Manager")
    print("=" * 80)
    print()
    
    # Get service account file
    service_account = input("Path to Firebase service account JSON: ").strip()
    
    # Initialize Firebase
    print("\n🔄 Initializing Firebase...")
    db = initialize_firebase(service_account)
    print("✅ Firebase initialized")
    
    while True:
        print("\n" + "=" * 80)
        print("Options:")
        print("1. Create/Update subscription")
        print("2. List all subscriptions")
        print("3. Exit")
        print("=" * 80)
        
        choice = input("\nSelect option: ").strip()
        
        if choice == '1':
            # Create/Update subscription
            school_id = input("\nSchool ID (e.g., ayirebida_2025-2026_First-Term): ").strip()
            
            try:
                max_students = int(input("Max Students: ").strip())
                max_classes = int(input("Max Classes: ").strip())
                
                print("\nExpiry Date Options:")
                print("1. 1 month from now")
                print("2. 3 months from now")
                print("3. 6 months from now")
                print("4. 1 year from now")
                print("5. Custom date (YYYY-MM-DD)")
                
                expiry_choice = input("Select option: ").strip()
                
                if expiry_choice == '1':
                    expiry_date = datetime.now() + timedelta(days=30)
                elif expiry_choice == '2':
                    expiry_date = datetime.now() + timedelta(days=90)
                elif expiry_choice == '3':
                    expiry_date = datetime.now() + timedelta(days=180)
                elif expiry_choice == '4':
                    expiry_date = datetime.now() + timedelta(days=365)
                elif expiry_choice == '5':
                    date_str = input("Enter date (YYYY-MM-DD): ").strip()
                    expiry_date = datetime.strptime(date_str, '%Y-%m-%d')
                else:
                    print("Invalid choice, defaulting to 1 year")
                    expiry_date = datetime.now() + timedelta(days=365)
                
                create_subscription(db, school_id, max_students, max_classes, expiry_date)
                
            except ValueError as e:
                print(f"❌ Invalid input: {e}")
                
        elif choice == '2':
            # List subscriptions
            list_subscriptions(db)
            
        elif choice == '3':
            print("\n👋 Goodbye!")
            break
            
        else:
            print("❌ Invalid option")

if __name__ == "__main__":
    main()
