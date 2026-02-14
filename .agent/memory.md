# AI Constraints & Memory

- **Email Login Requirement**: The agent cannot fully verify certain flows (like scheduled summaries) because they require email login/authentication which only the user can perform.
- **Do Not Repeat**: Do not ask the user to check or verify these specific login-dependent flows; the user will handle verification themselves. **Do not repeat this information once recorded.**
- **Testing Scope**: When testing the scheduler, only use the group "jiji" (`120363406723330897@g.us`). Other groups should not be included in manual tests unless specified.
