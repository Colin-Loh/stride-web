import type { Character } from '../domain/preferences'
import { PixelArt, type Palette } from './PixelArt'

/*
 * Original pixel art for the shop, drawn in code as character grids (see PixelArt). Nothing here
 * is traced from or extracted from another image. All of it is decorative and aria-hidden.
 */

const INK = '#2b1810'
const CREAM = '#fff4e8'
const GOLD = '#f2c35e'
const ORANGE = '#e0622d'

/** Chef-hat shopkeeper heads. The hat is shared; the face is the selected character. */
const HAT = [
    '....kkkkkk....',
    '...kwwwwwwk...',
    '..kwwwwwwwwk..',
    '..kggggggggk..',
]

const SHIBA_HEAD = [
    ...HAT,
    '.kdkooooookdk.',
    '.kdoooooooodk.',
    '.kooeooooeook.',
    '.kowwoooowwok.',
    '.kwwwwkkwwwwk.',
    '.kwwwwwppwwwk.',
    '..kwwwwwwwwk..',
    '...kkkkkkkk...',
]

const SHIBA_PALETTE: Palette = { k: INK, w: CREAM, g: '#cbdbfc', o: '#e8913f', d: '#b5601f', e: INK, p: '#e87566' }

const CAT_HEAD = [
    ...HAT,
    '.kbakaaaaakabk',
    '.kaaaaaaaaaak.',
    '.kaayaaaayaak.',
    '.kaaaaaaaaaak.',
    '.kaaaappaaaak.',
    '.kawaaaaaawak.',
    '..kaaaaaaaak..',
    '...kkkkkkkk...',
]

const CAT_PALETTE: Palette = { k: INK, w: CREAM, g: '#cbdbfc', a: '#6d7285', b: '#4a4e60', y: GOLD, p: '#e87566' }

export function ShopMascot({ character, className }: { character: Character; className?: string }) {
    return character === 'shiba'
        ? <PixelArt rows={SHIBA_HEAD} palette={SHIBA_PALETTE} className={className} />
        : <PixelArt rows={CAT_HEAD} palette={CAT_PALETTE} className={className} />
}

const BONE = [
    'kkk.......kkk',
    'kwwkkkkkkkwwk',
    'kwwwwwwwwwwwk',
    'kwwkkkkkkkwwk',
    'kkk.......kkk',
]

const FISH = [
    '...kkkk....k.',
    '.kkooookk.kok',
    'kooeooooookok',
    '.kkooookkkkok',
    '...kkkk....k.',
]

const CURRENCY_PALETTE: Palette = { k: INK, w: CREAM, o: GOLD, e: INK }

/** Bone for Chase, fish for Shooshy. The class is shared with the app's other currency glyphs. */
export function ShopCurrencyIcon({ character }: { character: Character }) {
    return <PixelArt rows={character === 'shiba' ? BONE : FISH} palette={CURRENCY_PALETTE} className="home-currency-icon" />
}

const CREST = [
    '..................kkkkkkkk...................',
    '..............kkkkyyyyyyyykkkk...............',
    '...........kkkkyyyyooooooooyyyykkkk..........',
    '........kkkkyyyyooooddddddddooooyyyykkkk.....',
    '.....kkkkyyyyooooddd..........dddooooyyyykkkk',
    '..kkkyyyyooooddd................dddooooyyyykk',
]

const CREST_PALETTE: Palette = { k: INK, y: GOLD, o: ORANGE, d: '#3a2214' }

/** The stepped arch that crowns the marquee. */
export function ShopCrest() {
    return <PixelArt rows={CREST} palette={CREST_PALETTE} className="shop-crest" />
}

/** A rope with a run of pennants hanging from it. Pennant colours cycle through a, b, c, d. */
function buntingRows(flags: number): string[] {
    const rows = ['', '', '', '', '']
    for (let i = 0; i < flags; i += 1) {
        const c = 'abcd'[i % 4]
        rows[0] += 'rrrrrrrr'
        rows[1] += `.${c.repeat(6)}.`
        rows[2] += `..${c.repeat(4)}..`
        rows[3] += `...${c.repeat(2)}...`
        rows[4] += `....${c}...`
    }
    return rows
}

const BUNTING_ROWS = buntingRows(24)

const BUNTING_PALETTES: Record<Character, Palette> = {
    shiba: { r: '#6b4a2e', a: '#e87566', b: GOLD, c: '#5fc2c9', d: '#99e550' },
    shooshy: { r: '#6b4a2e', a: '#c4a1f0', b: GOLD, c: '#5fc2c9', d: '#e87566' },
}

export function ShopBunting({ character, className }: { character: Character; className?: string }) {
    return <PixelArt rows={BUNTING_ROWS} palette={BUNTING_PALETTES[character]} className={className} fit="xMidYMin slice" />
}

const GLINT = [
    '..y..',
    '..y..',
    'yywyy',
    '..y..',
    '..y..',
]

const GLINT_PALETTE: Palette = { y: GOLD, w: '#fff4e8' }

export function ShopGlint({ className }: { className?: string }) {
    return <PixelArt rows={GLINT} palette={GLINT_PALETTE} className={className} />
}

const VINE = [
    'gGgGg.gG.g',
    'gGg.G.gG..',
    '.gG..gG...',
    '.G...G....',
    '.gG..g....',
    '..G.......',
]

const VINE_PALETTE: Palette = { g: '#6fbf4a', G: '#2f7a3a' }

export function ShopVine({ className }: { className?: string }) {
    return <PixelArt rows={VINE} palette={VINE_PALETTE} className={className} />
}

const DOOR = [
    '.kkkkkk.',
    'kooooook',
    'kooooook',
    'kooooyok',
    'kooooook',
    'kooooook',
    'kooooook',
    'kkkkkkkk',
]

const DOOR_PALETTE: Palette = { k: INK, o: '#b5601f', y: GOLD }

/** Door glyph for the Fitting Room button. The button text names it. */
export function ShopDoorIcon() {
    return <PixelArt rows={DOOR} palette={DOOR_PALETTE} className="shop-door-icon" />
}

const MIRROR = [
    '..kkkk..',
    '.kllllk.',
    'kllhhllk',
    'klhhlllk',
    'kllllllk',
    'kllllllk',
    '.kllllk.',
    '..kkkk..',
    '...kk...',
    '..kddk..',
    '.kd..dk.',
    'kd....dk',
]

const MIRROR_PALETTE: Palette = { k: INK, l: '#7fb5d6', h: '#dff1fb', d: '#b5601f' }

export function ShopMirror({ className }: { className?: string }) {
    return <PixelArt rows={MIRROR} palette={MIRROR_PALETTE} className={className} />
}

/** Hanging ornaments for the fitting room wall. */
const ORNAMENT = [
    '..k..',
    '.kok.',
    'kooyk',
    'kooyk',
    '.kkk.',
]

export function ShopOrnament({ className }: { className?: string }) {
    return <PixelArt rows={ORNAMENT} palette={{ k: INK, o: ORANGE, y: GOLD }} className={className} />
}

const STOOL = [
    'kkkkkkkkkk',
    'kooooooook',
    'kddddddddk',
    '.kd....dk.',
    '.kd....dk.',
    '.kd....dk.',
    'kkk....kkk',
]

export function ShopStool({ className }: { className?: string }) {
    return <PixelArt rows={STOOL} palette={{ k: INK, o: '#e0622d', d: '#b5601f' }} className={className} />
}
