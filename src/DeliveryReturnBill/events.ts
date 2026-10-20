/**
 * Events of the "Delivery Return Bill" flow.
 *
 * They are namespaced on purpose: the legacy delivery return flow
 * (src/DeliveryReturn) uses ON_DELIVERY_RETURN_CONFIRM_OK /
 * ON_DELIVERY_RETURN_REFRESH, so both flows can be mounted at the same time
 * without cross talking.
 */

/** Emitted after a product has been returned, to refresh the processed quantity. */
export const EVENT_RETURNED = "ON_DELIVERY_RETURN_BILL_RETURNED";

/** Emitted to refresh the scanned bill and its models. */
export const EVENT_REFRESH = "ON_DELIVERY_RETURN_BILL_REFRESH";
