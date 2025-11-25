---
title: Mermaid Examples
tags: [mermaid, diagrams, visualization]
---

# Mermaid Diagram Examples

This page demonstrates various Mermaid diagram types rendered using rehype-mermaid.

## Flowchart

```mermaid
graph TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great!]
    B -->|No| D[Debug]
    D --> A
```

## Sequence Diagram

```mermaid
sequenceDiagram
    participant U as User
    participant P as Processor
    participant R as Rehype-Mermaid
    
    U->>P: Process markdown
    P->>R: Transform mermaid blocks
    R-->>P: Return SVG/Image
    P-->>U: Return HTML
```

## Gantt Chart

```mermaid
gantt
    title Project Timeline
    dateFormat  YYYY-MM-DD
    section Phase 1
    Research           :done,    des1, 2024-01-01,2024-01-07
    Implementation     :active,  des2, 2024-01-08, 10d
    Testing           :         des3, after des2, 5d
    section Phase 2
    Documentation     :         des4, after des3, 3d
    Release          :         des5, after des4, 1d
```

## Class Diagram

```mermaid
classDiagram
    class RepoProcessor {
        +ProcessOptions options
        +process() Result
        +processFolder() Pages[]
    }
    
    class RehypeMermaid {
        +RehypeMermaidOptions options
        +transform() HAST
    }
    
    RepoProcessor --> RehypeMermaid : uses
```

## State Diagram

```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Processing : Start
    Processing --> Rendering : Parse Mermaid
    Rendering --> Complete : Generate SVG
    Complete --> [*]
    
    Processing --> Error : Failed
    Error --> [*]
```

## Entity Relationship Diagram

```mermaid
erDiagram
    POST ||--o{ MEDIA : contains
    POST {
        string hash
        string slug
        string title
        string content
    }
    MEDIA {
        string hash
        string path
        string type
        int size
    }
```