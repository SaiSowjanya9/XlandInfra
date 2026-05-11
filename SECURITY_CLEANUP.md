# Security Cleanup Instructions

This document provides instructions to clean the Git history of exposed secrets detected by GitGuardian.

## ⚠️ Important Warning

**Before proceeding:**
1. Create a backup of your repository
2. Notify all team members - they will need to re-clone after cleanup
3. All open PRs will need to be recreated after force push

## Step 1: Install git-filter-repo

git-filter-repo is the recommended tool (safer than BFG or filter-branch).

```bash
# Using pip
pip install git-filter-repo

# Or on Windows with Chocolatey
choco install git-filter-repo

# Or download directly from:
# https://github.com/newren/git-filter-repo
```

## Step 2: Create the Secrets Pattern File

Create a file named `secrets-to-remove.txt` with patterns to replace:

```
admin123==>REMOVED_SECRET
ops123==>REMOVED_SECRET
manager123==>REMOVED_SECRET
supervisor123==>REMOVED_SECRET
super123==>REMOVED_SECRET
exec123==>REMOVED_SECRET
executive123==>REMOVED_SECRET
franchise123==>REMOVED_SECRET
```

## Step 3: Clean the Repository

```bash
# Navigate to repository root
cd c:\Users\saiso\OneDrive\Desktop\PM\customer-portal

# Make sure you have a fresh clone (recommended)
# git clone --mirror <your-repo-url> customer-portal-cleanup
# cd customer-portal-cleanup

# Run git-filter-repo to replace secrets
git filter-repo --replace-text secrets-to-remove.txt --force

# If you want to also remove the dist folder from history:
git filter-repo --path admin-portal/dist --invert-paths --force
```

## Step 4: Alternative - Using BFG Repo Cleaner

If you prefer BFG (simpler but less flexible):

```bash
# Download BFG from https://rtyley.github.io/bfg-repo-cleaner/

# Create a file with passwords to remove (one per line)
echo "admin123" > passwords.txt
echo "ops123" >> passwords.txt
echo "manager123" >> passwords.txt
echo "supervisor123" >> passwords.txt
echo "exec123" >> passwords.txt
echo "franchise123" >> passwords.txt

# Run BFG
java -jar bfg.jar --replace-text passwords.txt customer-portal.git

# Clean up
cd customer-portal.git
git reflog expire --expire=now --all && git gc --prune=now --aggressive
```

## Step 5: Force Push the Cleaned History

```bash
# Force push all branches
git push origin --force --all

# Force push all tags
git push origin --force --tags
```

## Step 6: Notify Team Members

All team members must:
1. Delete their local repository
2. Re-clone the repository fresh
3. Never use `git pull` on the old clone (it will reintroduce old history)

## Step 7: Rotate All Exposed Credentials

Even though credentials have been removed from history, assume they are compromised:
1. Change all demo passwords
2. Rotate any API keys if exposed
3. Update database passwords if any were committed
4. Regenerate JWT secrets

## Step 8: Verify GitGuardian Resolution

After force push:
1. Go to your GitGuardian dashboard
2. Mark the incidents as resolved
3. Run a new scan to confirm no secrets remain

## Files Modified in This Cleanup

The following files were modified to remove hardcoded credentials:

### Frontend
- `admin-portal/src/utils/userStore.js` - Replaced hardcoded passwords with environment-based demo auth
- `admin-portal/src/pages/EmployeeLogin.jsx` - Added secure role-based demo login buttons
- `admin-portal/src/pages/CustomerLogin.jsx` - Removed demo credential display
- `admin-portal/src/pages/Login.jsx` - Removed demo credential display

### Backend
- `backend/routes/admin.js` - Uses environment variables for demo mode
- `backend/routes/staff.js` - Uses environment variables for demo mode
- `backend/.env.example` - Added DEMO_MODE and DEMO_PASSWORD_HASH variables

### Documentation
- `README.md` - Removed hardcoded credentials
- `Project_Documentation.md` - Removed hardcoded credentials

### Database
- `backend/database/schema_v2.sql` - Replaced password hints with placeholder instructions
- `backend/database/schema_v3.sql` - Replaced password hints with placeholder instructions

### Configuration
- `.gitignore` - Enhanced to prevent future credential commits

## Setting Up Demo Mode (If Needed)

To enable demo mode after cleanup:

1. Generate a bcrypt hash for your demo password:
```bash
node -e "console.log(require('bcryptjs').hashSync('your-secure-demo-password', 10))"
```

2. Add to your `.env` file (never commit this!):
```
DEMO_MODE=true
DEMO_PASSWORD_HASH=$2a$10$your-generated-hash-here
```

3. Use the demo credentials to test (the password you chose, NOT the old exposed ones)

## Questions?

If you encounter issues, contact your security team before proceeding.
