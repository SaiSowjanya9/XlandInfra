/**
 * Which `portal_notifications` rows belong to the customer making the request.
 *
 * One fragment for all four reads — the list, its unread count, and both mark-read routes — because
 * they have to agree: a row a customer can see but not dismiss sticks in their bell for ever, and a
 * row they can dismiss but not see is a notification nobody will ever read.
 *
 * The three branches:
 *
 *   1. anything addressed to the `customer` role by the partner that owns this customer's property.
 *      This is the original rule, and it is **every** customer of that partner — which is why a
 *      complaint, which concerns exactly one household, must not travel on it, and is excluded here.
 *   2. a work order, scoped by the property it is against.
 *   3. a complaint, scoped by `user_id`, which for a `customer` row is the `customer_accounts.id`
 *      that raised it. (`user_id` is already overloaded across the three tables the portals
 *      authenticate against, so this is the existing convention rather than a new one.)
 *
 * **Every branch is an EXISTS, and the caller joins nothing.** These reads used to
 * `LEFT JOIN onboarded_properties op ON op.franchise_partner_id = pn.franchise_partner_id` and test
 * `op.id = ?`: that join matches one row per property the partner owns, so any notification the
 * property condition did not narrow — a work order, and now a complaint — came back once per
 * property. A customer with one unread update saw it a dozen times, and the unread badge counted
 * them all. A semi-join cannot multiply rows, which is the whole point of writing it this way.
 *
 * Regression test: `node --test backend/utils/customerNotificationScope.test.js`.
 */

// A payment, like a complaint, concerns one household, so it travels on user_id (the
// customer_accounts.id it is for) and never on the partner-wide first branch.
const CUSTOMER_NOTIFICATION_SCOPE_SQL = `(
        (pn.role_type = 'customer'
          AND (pn.reference_type IS NULL OR pn.reference_type NOT IN ('complaint', 'payment'))
          AND EXISTS (
            SELECT 1 FROM onboarded_properties op
             WHERE op.franchise_partner_id = pn.franchise_partner_id AND op.id = ?
          ))
        OR (pn.role_type = 'customer' AND pn.reference_type = 'work_order' AND EXISTS (
          SELECT 1 FROM work_orders wo WHERE wo.id = pn.reference_id AND wo.property_id = ?
        ))
        OR (pn.role_type = 'customer' AND pn.reference_type IN ('complaint', 'payment') AND pn.user_id = ?)
      )`;

/**
 * @param {object} customer  req.customer, as authenticateCustomer builds it
 * @returns {{sql: string, params: Array}} the fragment and its three bound values
 */
const customerNotificationScope = (customer = {}) => ({
  sql: CUSTOMER_NOTIFICATION_SCOPE_SQL,
  params: [customer.propertyId ?? null, customer.propertyId ?? null, customer.id ?? null]
});

module.exports = { customerNotificationScope, CUSTOMER_NOTIFICATION_SCOPE_SQL };
