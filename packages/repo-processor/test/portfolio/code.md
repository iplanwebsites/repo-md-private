---
public: true
---

# Testing Code Blocks and Markdown Styling

This is a test article to demonstrate various code block styling capabilities in markdown.

## Python Code Example

```python
import requests

def fetch_data(url="https://api.example.com/data"):
    response = requests.get(url)
    return response.json()

# Example usage
data = fetch_data()
print(data)
```

## JavaScript Code with URLs

```javascript
const apiEndpoint = 'https://api.example.com/v1/users';

async function fetchUserData(userId) {
    const response = await fetch(`${apiEndpoint}/${userId}`);
    return response.json();
}

// Example usage
fetchUserData('123')
    .then(data => console.log(data))
    .catch(error => console.error(error));
```

## HTML with Links

```html
<!DOCTYPE html>
<html>
<head>
    <title>Test Page</title>
</head>
<body>
    <a href="https://example.com">Visit Example</a>
    <a href="https://github.com/user/repo">GitHub Repository</a>
</body>
</html>
```

## CSS Styling

```css
.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
}

/* URL in comment */
/* https://example.com/design-system */
```

## Shell Commands

```bash
# Clone repository
git clone https://github.com/user/repo.git

# Install dependencies
npm install

# Start server
npm start
```

## SQL Queries

```sql
SELECT * FROM users 
WHERE email LIKE '%@example.com'
AND created_at > '2024-01-01';

-- Example URL in comment
-- https://example.com/api/users
```

## Markdown Inside Code Block

```markdown
# This is a markdown heading

- List item 1
- List item 2

[Link text](https://example.com)

> Blockquote example
```

## JSON with URLs

```json
{
    "api": {
        "endpoints": {
            "users": "https://api.example.com/users",
            "posts": "https://api.example.com/posts"
        },
        "version": "1.0.0"
    }
}
```

## TypeScript with Comments

```typescript
interface User {
    id: string;
    name: string;
    email: string;
}

// API endpoint
const API_URL = 'https://api.example.com';

async function getUser(id: string): Promise<User> {
    const response = await fetch(`${API_URL}/users/${id}`);
    return response.json();
}
```

## Regular Text Content

This is some regular text content between code blocks. It includes some **bold** and *italic* text, as well as some `inline code`.

### Lists

1. First item
2. Second item
3. Third item

- Unordered item 1
- Unordered item 2
- Unordered item 3

### Links

[Regular markdown link](https://example.com)

### Blockquotes

> This is a blockquote
> With multiple lines
> And some **formatting**