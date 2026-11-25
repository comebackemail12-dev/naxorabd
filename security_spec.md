# Security Specification — ViralDrop BD

## 1. Data Invariants
1. **Main Admin Supremacy**: Only verified Google account `comebackemail12@gmail.com` (`email_verified == true`) can mutate `/storeConfig/*`, approve/suspend `/admins/*`, or view/purge audit logs.
2. **No Self-Promotion**: A user requesting admin access at `/admins/{uid}` can ONLY create their own doc with `status == 'pending'` and all permissions set to `false`. Only Main Admin can set `status == 'approved'` or enable any permission flag.
3. **Granular Admin Permissions**: Approved Normal Admins can only mutate products, categories, coupons, orders, or tickets if their `/admins/{uid}.permissions[perm]` is `true` (or if caller is Main Admin).
4. **PII Isolation**: `/users/{uid}`, `/orders/{orderId}`, and `/tickets/{ticketId}` contain PII (phone, address, email, TrxID). Only the owning user, approved admins, or Main Admin may read them. List queries on `/orders` and `/tickets` require `resource.data.userId == request.auth.uid` for shoppers.
5. **Immutable Audit & Ownership Fields**: `userId`, `createdBy`, `createdAt`, `uid` cannot be reassigned on updates; all `createdAt` / `updatedAt` timestamps must equal `request.time`.
6. **Terminal Order Locking**: Once an order reaches `delivered` or `cancelled`, shoppers cannot modify it; only Main Admin or order-managing admins can perform adjustments.
7. **Master Gate on Subcollections**: `/products/{productId}/reviews/{reviewId}` requires the parent `/products/{productId}` to exist and enforces `rating` between `1` and `5`.

## 2. "Dirty Dozen" Attack Payloads (Must All Fail with PERMISSION_DENIED)
1. **Admin Self-Approval**: Shopper writes `/admins/{uid}` with `status: 'approved'` and `permissions: { canDeleteProduct: true }`.
2. **Admin Privilege Escalation Update**: Approved Normal Admin updates own `/admins/{uid}` to add `canDeleteProduct: true`.
3. **Unverified Email Admin Spoof**: Token with `email: 'comebackemail12@gmail.com'` and `email_verified: false` attempts write to `/storeConfig/global`.
4. **Shadow Field Injection on Order**: Shopper creates `/orders/{id}` with extra field `paymentStatus: 'paid'` or `isVerified: true`.
5. **Order Price/Total Forgery**: Shopper creates `/orders/{id}` with `totalBdt: -500` or `status: 'delivered'`.
6. **Cross-User Order Read (PII Leak)**: Shopper A attempts `get` or `list` on `/orders` without `where('userId', '==', uid)`.
7. **Cross-User Profile Read**: Shopper A reads `/users/{shopperB_uid}`.
8. **Path ID Poisoning**: Attacker creates `/products/<1500-char-invalid-id!@#>` to bypass length/regex guard.
9. **Code Override Tampering**: Approved Normal Admin attempts to update `/storeConfig/codeOverrides`.
10. **Review Without Parent Product**: User creates `/products/nonexistent_id/reviews/r1`.
11. **Timestamp Forgery**: User creates `/orders/{id}` with backdated `createdAt`.
12. **Ticket Ownership Hijack**: Shopper updates `/tickets/{id}` belonging to another `userId`.
