---
name: development-guide
description: Standard procedures for adding features, views, and Firebase data patterns.
---

# Development Guide

## 1. Adding New Storage Keys (Firebase)
When adding new user data fields:
1.  **Define Path:** In `storageService.ts`, mapping to `users/{uid}/...`.
2.  **Add Accessors:** Create async `get` and `save` functions.
    ```typescript
    export async function getNewFeature(): Promise<NewFeature> {
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');
      const docRef = doc(db, `users/${user.uid}/data/newfeature`);
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? docSnap.data() as NewFeature : DEFAULT_VALUE;
    }
    ```
3.  **Update Security:** Ensure Firebase rules allow the new path (check `firebase.json` or console).

## 2. Adding a New View
To add a top-level page:
1.  **Types:** Add enum value to `AppView` in `types.ts`.
2.  **Component:** Create `components/MyNewView.tsx`.
3.  **Navigation:**
    - Desktop: Add to `DesktopSidebar.tsx` navItems.
    - Mobile: Add to `MobileBottomNav.tsx` navItems.
4.  **Routing:** Add `AnimatePresence` case in `App.tsx`.

## 3. Adding AI Features
1.  **Schema:** Define a `SchemaType` object in `geminiService.ts`.
2.  **Model:** Use `GEMINI_TEXT_MODEL` (`gemini-2.0-flash-exp`).
3.  **Call:**
    ```typescript
    const result = await model.generateContent({
      contents: [...],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: mySchema
      }
    });
    ```
4.  **IDs:** Always generate UUIDs locally (`crypto.randomUUID()`) if the AI suggests items.
