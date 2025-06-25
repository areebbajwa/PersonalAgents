# Firebase CLI

A command-line tool for Firebase data operations (Firestore, Auth, Storage) using the Firebase Admin SDK.

## Features

- **Firestore Operations**: Add, list, get, update, delete documents
- **Authentication**: Get user information by ID or email
- **Storage**: List files, get file info, upload files
- **Advanced Queries**: Collection group queries, list collections

## Installation

The tool is already set up with dependencies installed. To make it globally accessible:

```bash
# From the PersonalAgents root directory
./scripts/setup-global-cli-tools.sh
```

## Configuration

Uses the Firebase service account from `config/firebase-service-account.json` for authentication.

## Usage

### Firestore Commands

```bash
# Add a document
firebase-cli firestore add <collection> --data '{"field":"value"}'
firebase-cli firestore add <collection> --file data.json

# List documents
firebase-cli firestore list <collection>
firebase-cli firestore list <collection> --limit 50
firebase-cli firestore list <collection> --where field:==:value
firebase-cli firestore list <collection> --order-by createdAt --order desc

# Get a document
firebase-cli firestore get <collection> <id>

# Update a document
firebase-cli firestore update <collection> <id> --data '{"field":"new value"}'

# Delete a document
firebase-cli firestore delete <collection> <id>

# List all collections
firebase-cli firestore collections

# Query collection group
firebase-cli firestore query-group <collectionId>
firebase-cli firestore query-group <collectionId> --where field:==:value
```

### Authentication Commands

```bash
# Get user by ID
firebase-cli auth get-user <uid>

# Get user by email
firebase-cli auth get-user user@example.com
```

### Storage Commands

```bash
# List files
firebase-cli storage list
firebase-cli storage list path/to/directory/
firebase-cli storage list --limit 50

# Get file info
firebase-cli storage get-info path/to/file.txt

# Upload file
firebase-cli storage upload local-file.pdf storage/path/file.pdf
firebase-cli storage upload image.png images/photo.png --content-type image/png
```

### Output Formats

All commands support JSON output with the `--json` flag:

```bash
firebase-cli firestore list users --json
firebase-cli auth get-user user@example.com --json
```

## Examples

### Working with Firestore

```bash
# Create a new user document
firebase-cli firestore add users --data '{"name":"John Doe","email":"john@example.com","active":true}'

# Find active users
firebase-cli firestore list users --where active:==:true

# Update user status
firebase-cli firestore update users abc123 --data '{"active":false}'
```

### Managing Files in Storage

```bash
# Upload a profile picture
firebase-cli storage upload ./profile.jpg users/john-doe/profile.jpg

# Get download URL
firebase-cli storage get-info users/john-doe/profile.jpg
```

## Testing

Run the test suite:

```bash
npm test
```

## Comparison with Firebase MCP Server

This CLI tool provides the same functionality as the Firebase MCP server but as a standalone command-line tool:

| Feature | MCP Server | This CLI |
|---------|------------|----------|
| Firestore CRUD | ✓ | ✓ |
| Auth get user | ✓ | ✓ |
| Storage operations | ✓ | ✓ |
| Collection groups | ✓ | ✓ |
| Direct CLI access | ✗ | ✓ |
| Scriptable | Limited | ✓ |

## Error Handling

The tool provides clear error messages and appropriate exit codes:
- Exit code 0: Success
- Exit code 1: Error (with descriptive message)

## Notes

- All Firestore write operations automatically add timestamp fields
- Storage URLs are signed and expire after 1 hour
- The tool uses the project's existing Firebase configuration