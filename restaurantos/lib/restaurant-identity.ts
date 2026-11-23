const configuredName = process.env.NEXT_PUBLIC_RESTAURANT_NAME?.trim();
const configuredLocation = process.env.NEXT_PUBLIC_RESTAURANT_LOCATION?.trim();

const name = configuredName || "My restaurant";
const location = configuredLocation || "Main location";

export const restaurantIdentity = {
  name,
  location,
  initial: name.charAt(0).toUpperCase() || "M",
};
