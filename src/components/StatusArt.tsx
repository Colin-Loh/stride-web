import type { Character } from '../domain/preferences'
import { PixelArt, type Palette } from './PixelArt'
import { ShopBunting, ShopVine } from './ShopArt'

/*
 * Original pixel art for the Status room, drawn in code as character grids (see PixelArt) in the
 * same palette family as the Shop fitting room. All of it is decorative: aria-hidden, unfocusable,
 * and pointer-events none through the .status-decor class.
 */

const INK = '#2b1810'

const CAT_TREE = [
    '..........kkkk..',
    '.........kyyyyk.',
    '.kkkkkkkkkkkkkk.',
    'kwwwwwwwwwwwwwwk',
    'kWWWWWWWWWWWWWWk',
    '.kkkkkrRrkkkkkk.',
    '......krRrk.....',
    '......krRrk.....',
    '......krRrk.....',
    '..kkkkkkkkkkkk..',
    '.kwwwwwwwwwwwwk.',
    '.kWWWWWWWWWWWWk.',
    '..kkkkkrRrkkkk..',
    '......krRrk.....',
    '......krRrk.....',
    '......krRrk.....',
    '......krRrk.....',
    '.kkkkkkkkkkkkkk.',
    'kWWWWWWWWWWWWWWk',
    'kkkkkkkkkkkkkkkk',
]

const CAT_TREE_PALETTE: Palette = { k: INK, w: '#c98a52', W: '#8a5a34', r: '#e0c08a', R: '#a67c45', y: '#e87566' }

const PERCH = [
    'kkkkkkkkkkkkkkkk',
    'kwwwwwwwwwwwwwwk',
    'kWWWWWWWWWWWWWWk',
    '.kkkkkkkkkkkkkk.',
    '..kk........kk..',
    '..kW........Wk..',
    '..kk........kk..',
]

const BOWL = [
    '.kkkkkkkkkk.',
    'kdddddddddk.',
    'kbbbbbbbbbbk',
    'kBBBBBBBBBBk',
    '.kBBBBBBBBk.',
    '..kkkkkkkk..',
]

const KIBBLE: Palette = { k: INK, d: '#8a5a34', b: '#5fa0e8', B: '#3a6fb0' }

const DOG_HOUSE = [
    '.......kkkkkk.......',
    '.....kkRRRRRRkk.....',
    '...kkRRrRRrRRRRkk...',
    '.kkRRrRRRRRRrRRRRkk.',
    'kRRRRRRrRRRRRRrRRRRk',
    'kkkkkkkkkkkkkkkkkkkk',
    '.kwwwwwkkkkkkwwwwwk.',
    '.kwwwwkkkkkkkkwwwwk.',
    '.kwwwkkkkkkkkkkwwwk.',
    '.kwwwkkkkkkkkkkwwwk.',
    '.kwwwkkkkkkkkkkwwwk.',
    '.kkkkkkkkkkkkkkkkkk.',
]

const DOG_HOUSE_PALETTE: Palette = { k: INK, R: '#b5532d', r: '#8f3a17', w: '#d9a35f' }

const BALL = [
    '..kkkk..',
    '.krrrrk.',
    'krwrrrrk',
    'krrrrrrk',
    'krrrrrrk',
    '.krrrrk.',
    '..kkkk..',
]

const BALL_PALETTE: Palette = { k: INK, r: '#e0622d', w: '#fff4e8' }

const DOG_BONE = [
    'kkk.......kkk',
    'kwwkkkkkkkwwk',
    'kwwwwwwwwwwwk',
    'kwwkkkkkkkwwk',
    'kkk.......kkk',
]

const DOG_BONE_PALETTE: Palette = { k: INK, w: '#fff4e8' }

const STAR = [
    '..y..',
    '.yyy.',
    'yyyyy',
    '.yyy.',
    '.y.y.',
]

const STAR_PALETTE: Palette = { y: '#f2c35e' }

/**
 * The room behind a character on the Status screen: back wall, floor, bunting, vines and the
 * character's own furniture (cat tree and food bowl for Shooshy, dog house, ball and bone for
 * Chase). Placed before the character in the DOM and never receives focus or clicks.
 */
export function StatusRoom({ character }: { character: Character }) {
    return (
        <div className="status-decor" aria-hidden="true">
            <ShopBunting character={character} className="status-room-bunting" />
            <ShopVine className="shop-vine status-room-vine status-room-vine-left" />
            <ShopVine className="shop-vine status-room-vine status-room-vine-right" />
            <PixelArt rows={STAR} palette={STAR_PALETTE} className="status-room-star status-room-star-left" />
            <PixelArt rows={STAR} palette={STAR_PALETTE} className="status-room-star status-room-star-right" />
            {character === 'shooshy' ? (
                <>
                    <PixelArt rows={CAT_TREE} palette={CAT_TREE_PALETTE} className="status-room-item status-room-tree" />
                    <PixelArt rows={PERCH} palette={CAT_TREE_PALETTE} className="status-room-item status-room-perch" />
                    <PixelArt rows={BOWL} palette={KIBBLE} className="status-room-item status-room-bowl" />
                </>
            ) : (
                <>
                    <PixelArt rows={DOG_HOUSE} palette={DOG_HOUSE_PALETTE} className="status-room-item status-room-house" />
                    <PixelArt rows={BALL} palette={BALL_PALETTE} className="status-room-item status-room-ball" />
                    <PixelArt rows={DOG_BONE} palette={DOG_BONE_PALETTE} className="status-room-item status-room-floor-bone" />
                </>
            )}
        </div>
    )
}
