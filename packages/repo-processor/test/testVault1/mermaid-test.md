---
public: true
title: Mermaid Diagram Test
---

# Mermaid Diagram Test

This page tests the rendering of Mermaid diagrams.

## Simple Flow Chart

```mermaid
graph TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great!]
    B -->|No| D[Debug]
    D --> B
```

## Sequence Diagram

```mermaid
sequenceDiagram
    participant User
    participant System
    participant Database
    
    User->>System: Request data
    System->>Database: Query
    Database-->>System: Results
    System-->>User: Display data
```

## Regular Code Block

This should remain a regular code block:

```javascript
console.log('This is not a mermaid diagram');
```

## Class Diagram

```mermaid
classDiagram
    class Animal {
        +String name
        +int age
        +void eat()
        +void sleep()
    }
    
    class Dog {
        +String breed
        +void bark()
    }
    
    class Cat {
        +String color
        +void meow()
    }
    
    Animal <|-- Dog
    Animal <|-- Cat
```