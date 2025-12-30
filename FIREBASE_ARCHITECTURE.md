# Firebase Architecture & Data Flow

This document details how the application interacts with Firebase Firestore, specifically focusing on how large datasets are handled, how data is collated from various pages, and how read/write operations are optimized for performance and scalability.

## 1. Overview: The Hybrid Schema
The application uses a **hybrid architecture** combining a central document with subcollections to bypass Firestore's 1MB document size limit while maintaining efficient data retrieval.

- **Main Document (`schools/{schoolId}`)**: Stores metadata, settings, user logs, and global configuration.
- **Subcollections (`schools/{schoolId}/{collectionName}`)**: Stores large lists of data entities.
  - `students`
  - `scores`
  - `classes`
  - `subjects`
  - `assessments`

---

## 2. Reading Data: Lazy Loading & On-Demand Fetching
To optimize performance and reduce Firestore quota usage, the application has moved away from a full "Fan-In" strategy to a **Lazy Loading** approach. This means data is only fetched when explicitly needed by the user.

### 2.1. Initial Load - Metadata Only (`Dashboard` / `App Init`)
When the application starts, it performs a lightweight fetch:
1.  **Main Document**: Reads `schools/{schoolId}` to get settings, user roles, and access rights.
2.  **Metadata (Parallel)**: The `loadMetadata()` function fetches critical lightweight lists:
    *   `classes`
    *   `subjects`
    *   `assessments`
    This ensures the global navigation and dropdowns work immediately without waiting for heavy student or score data.

### 2.2. On-Demand Data Loading
Heavy datasets are fetched only when navigating to specific pages:

*   **Students**: The `loadStudents` method is called when visiting the **Students** or **Student Progress** pages. It fetches the `students` subcollection.
*   **Scores (Bucketed)**: The `loadScores(classId, subjectId)` method is called on the **Score Entry** page.
    *   **Optimization**: Scores are stored in "buckets" (subcollections) grouped by subject (e.g., `schools/{schoolId}/score_buckets/{subjectId}`).
    *   This prevents loading millions of scores for the entire school when only one class/subject is being edited.

### 2.3. Real-time Synchronization (Selective)
*   **Resource-Specific**: Subcollections are fetched once via `getDocs` to save reads (`fetchSubcollection` helper). Real-time listeners on subcollections are disabled by default in this mode to prioritize cost savings.

### 2.4. Read Optimizations & Consistency Guards
Recent improvements have added several layers of protection to minimize unnecessary reads:

1.  **Fetch Deduplication (In-flight Promise Tracking)**:
    -   The `DataContext` maintains an `inflightPromises` map.
    -   If multiple components request the same data (e.g., `loadStudents`) simultaneously, the system returns the existing in-flight promise instead of triggering redundant Firestore calls.
2.  **Metadata-Driven Consistency (`lastLoadedTimestamps`)**:
    -   The application tracks the `lastUpdated` timestamp from the server for each collection.
    -   We compare this against a local `_loaded_` marker. 
    -   If the local data is already up-to-date with the server's version, the fetch is skipped entirely.
3.  **Dirty State Protection (Data Loss Guard)**:
    -   If a user has unsaved local changes (marked in `dirtyFields`), the automatic lazy-loaders will **SKIP** fetching data from the cloud.
    -   This prevents the "Stale Overwrite" bug where a background fetch would wipe out a user's unpushed modifications.
4.  **Stable Dependencies**:
    -   Loading functions like `loadStudents` and `loadMetadata` have stable `useCallback` references (depending only on `schoolId`).
    -   This prevents reactive re-fetches triggered by changes in local array lengths.

---

## 3. Writing Data: The "Fan-Out" Strategy
Writing data involved a complex challenge of ensuring atomicity while dealing with the "Fan-Out" architecture (writing to many different documents).

### 3.1. Change Detection (`DataContext.ts`)
The application does **not** send the entire application state on every save.
-   **Dirty Fields**: The `DataContext` tracks exactly which top-level keys (`students`, `scores`, etc.) have changed using a `dirtyFields` Set.
-   **Granular Trigger**: `saveToCloud` is triggered manually or by specific events. It ignores fields that haven't changed.

### 3.2. Universal Transactional Save (`saveDataTransaction`)
Located in `firebaseService.ts`, this is the core engine for writing data. It accepts a payload of *updates* and *deletions* and executes them within a **Firestore Transaction**.

**Process:**
1.  **Transaction Start**: Opens a transaction to ensure atomic reads and writes.
2.  **Iteration**: Loops through the keys provided in the update payload.
3.  **Branch A: Subcollections (Scalable Data)**
    -   Used for: `students`, `scores`, `classes`, `subjects`, `assessments`.
    -   **Action**: Iterates through the list of items in the payload.
    -   **Write**: Sets each item as an individual document: `schools/{schoolId}/{key}/{itemId}`.
    -   **Merge**: Uses `{ merge: true }` to allow partial updates of items.
    -   **Delete**: If IDs are marked for deletion, it executes `transaction.delete()` on those specific documents.
    -   *Note*: The main document is **not** touched for these keys.
4.  **Branch B: Main Document (Metadata)**
    -   Used for: `settings`, `userLogs`, `activeSessions`, `users`.
    -   **Action**: Merges the updates into the main document `schools/{schoolId}`.
    -   **Intelligent Merging**:
        -   *Arrays with IDs*: Loads current server data, overlays local updates (by ID), and applies deletions.
        -   *Objects*: Merges properties (e.g., `settings`).
    -   **Maintenance**: implementation includes self-healing logic, such as pruning `userLogs` to the last 20 entries to prevent infinite growth.

### 3.3. Granular Refresh
Immediately after a successful save:
-   The system does **not** re-download the entire database.
-   It calls `refreshFromCloud` with *only* the keys that were just modified (`keysToRefresh`).
-   This ensures the UI reflects the server state (including any server-side timestamps or triggers) without incurring the cost of a full database read.

### 3.4. Post-Save Metadata Synchronization
To prevent immediate "stale" re-fetches after a successful save:
-   `saveToCloud` proactively updates the local `_loaded_` timestamps to match the server's `lastUpdated` metadata.
-   This "certifies" that the local state is identical to the cloud state, suppressing the next scheduled or page-driven lazy load.

---

## 4. Local Caching & Persistence

The application employs a layered caching strategy to minimize both latency and API costs.

### 4.1. localStorage Persistence
-   Large data sets (`students`, `scores`, `classes`, etc.) are persisted in `localStorage` via the `useLocalStorage` hook.
-   This allows the application to boot up with the last known good state, making it feel performant even on slow connections.

### 4.2. Baseline Sync (`originalData`)
-   A `useRef` called `originalData` stores the state of the database exactly as it was when last loaded from the cloud.
-   **Smart Diffing**: Every write operation (add/edit/delete) compares the current state against `originalData`.
-   **Dirty Tracking**: Only fields that differ from `originalData` are marked as dirty and uploaded during the next save.

### 4.3. Correlation: Cache vs. Online
-   **Writes**: Users interact with the local cache immediately (Optimistic UI). Operations are queued in an Internal `offlineQueue` if the network is unavailable.
-   **Reads**: The online database is viewed as the "Source of Truth" for timestamps, but the local cache is the "Source of Truth" for display. An online read only occurs if the server's `lastUpdated` metadata is newer than the cache.

---

## 4. Specific Workflows

### 4.1. Saving Large Data (e.g., Scores)
1.  User edits scores on the Score Entry page.
2.  `DataContext` marks `scores` as dirty.
3.  User clicks "Save".
4.  `saveToCloud` generates a payload containing *only* the modified `scores` list (or the full list depending on the implementation version).
5.  `saveDataTransaction` iterates through the scores.
6.  **Bucketing**: Scores are saved into their respective subject buckets (`schools/{schoolId}/score_buckets/{subjectId}`) to optimize future reads. Individual score documents in the main collection are avoided.
7.  The main document is untouched, preventing bloat.

### 4.2. Handling Offline/Network Issues
-   **Validation**: Checks network status before attempting save.
-   **Offline Queue**: If offline, the payload is added to an `offlineQueue`.
-   **Error Handling**: Transient errors trigger a retry or queue addition. Permanent errors (Permissions, Quota) halt the process and alert the user.

### 4.3. Legacy Migration
-   To support older accounts, a `migrateLegacyData` function runs on load.
-   If it detects large arrays (like `students`) inside the *main* document, it automatically batch-moves them to the new subcollections and cleans up the main document.

---

## 5. Security & IDs
-   **Document IDs**: Composed of `sanitizedSchoolName_year_term` (e.g., `st-marys-high_2024-2025_term-1`).
-   **Sanitization**: Strict rules remove spaces and special characters to ensure URL-safe and consistent IDs.
-   **Access Control**: Security rules (configured in Firestore Console) enforce that users can only read/write documents where they have the correct password/authentication token (though currently largely handled via application-level logic and simple password checks stored in the doc).
