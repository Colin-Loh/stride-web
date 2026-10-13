/**
 * The brick wall behind the sign: a pixel-style pattern of two courses of bricks, the second
 * course offset by half a brick. Decorative, so it carries no text.
 */
export function BrickWall() {
    return (
        <svg className="shop-wall" aria-hidden="true" focusable="false">
            <defs>
                <pattern id="shop-brick" width="32" height="16" patternUnits="userSpaceOnUse">
                    <rect width="32" height="16" fill="#1d4a3a" />
                    <rect x="0" y="0" width="32" height="2" fill="#0b1f18" />
                    <rect x="0" y="0" width="2" height="8" fill="#0b1f18" />
                    <rect x="16" y="8" width="2" height="8" fill="#0b1f18" />
                    <rect x="3" y="4" width="10" height="3" fill="#245a46" />
                    <rect x="19" y="12" width="10" height="3" fill="#245a46" />
                </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#shop-brick)" />
        </svg>
    )
}

