# Supabase Notes

## Project
- Organization: MyPetID-Home
- New project name: MyPetID-Home
- Region: us-east-2
- Previous inactive project ref: bzfmluscikipkwaiophn
- New project ref is stored in Clydius profile env.

## Backups
Imported to the VM for inspection:
- `/home/ubuntu/workspaces/mypetid/imports/db_cluster-29-09-2025.backup.gz`
- `/home/ubuntu/workspaces/mypetid/imports/bzfmluscikipkwaiophn.storage.zip`

The database backup contains useful public tables: users, pets, nfc_tags, pet_locations, scan_records, found_pet_reports, profile_views, admin_users, notifications, user_settings, user_social_links, device_logins, and system_health. Restore selectively; do not blindly import old auth/storage internals.
