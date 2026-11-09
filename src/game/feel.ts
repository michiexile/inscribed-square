// Feel constants that the level validator needs as well as the game. All are guesses to settle in playtest (#5, #12).

/**
 * Largest corner distance from the curve at which a held square snaps onto a nearby inscribed square, in curve units
 * (the curve is about 2 wide). The snap only happens onto a real square, so near-misses never count.
 */
export const TOLERANCE = 0.05;

/** How long Avoid Folds gives the player to find another square after losing theirs, in milliseconds. */
export const GRACE_MS = 3000;
