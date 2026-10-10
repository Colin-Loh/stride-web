/** Same scale as the character stills, so an overlay lines up with the frame it sits on. */
export const STILL_SCALE = 0.5

/** Public URL of one item's still-frame art. The file name is the item id. */
export const cosmeticUrl = (itemId: string): string => `${import.meta.env.BASE_URL}cosmetics/${itemId}.png`
