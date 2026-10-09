import type { Character } from '../domain/preferences'
import { DANCE_SPRITES, DANCE_STILL_FRAME, type SpriteSheet } from '../sprites'
import { buildCardLayout, CARD, type CardData, type CardItem, type Radius } from './cardLayout'

/** A decoded dance sheet and the frame to stand still on. */
export interface CardSprite {
    image: CanvasImageSource
    sheet: SpriteSheet
    frame: number
}

const FONT_FAMILY = 'system-ui, "Segoe UI", sans-serif'

const radii = (radius: Radius | undefined): number | [number, number, number, number] => radius ?? 0

/** Paints the layout on a 2D context. Pixel art is scaled without smoothing. */
export function drawCard(ctx: CanvasRenderingContext2D, items: readonly CardItem[], sprite: CardSprite | null): void {
    for (const item of items) {
        if (item.kind === 'rect') {
            ctx.fillStyle = item.fill
            ctx.beginPath()
            ctx.roundRect(item.x, item.y, item.width, item.height, radii(item.radius))
            ctx.fill()
        } else if (item.kind === 'circle') {
            ctx.fillStyle = item.fill
            ctx.beginPath()
            ctx.arc(item.x, item.y, item.radius, 0, Math.PI * 2)
            ctx.fill()
        } else if (item.kind === 'text') {
            ctx.textBaseline = 'alphabetic'
            ctx.textAlign = 'left'
            ctx.fillStyle = item.fill
            ctx.font = `${item.weight} ${item.size}px ${FONT_FAMILY}`
            ctx.fillText(item.text, item.x, item.y)
            if (item.suffix) {
                const width = ctx.measureText(item.text).width
                ctx.fillStyle = item.suffix.fill
                ctx.font = `${item.weight} ${item.suffix.size}px ${FONT_FAMILY}`
                ctx.fillText(item.suffix.text, item.x + width, item.y)
            }
        } else if (sprite) {
            const { sheet, frame } = sprite
            const scale = Math.min(item.width / sheet.frameWidth, item.height / sheet.frameHeight)
            const width = sheet.frameWidth * scale
            const height = sheet.frameHeight * scale
            ctx.imageSmoothingEnabled = false
            ctx.drawImage(
                sprite.image, frame * sheet.frameWidth, 0, sheet.frameWidth, sheet.frameHeight,
                item.x + (item.width - width) / 2, item.y + (item.height - height) / 2, width, height,
            )
        }
    }
}

function loadSprite(character: Character): Promise<CardSprite> {
    const sheet = DANCE_SPRITES[character]
    return new Promise((resolve, reject) => {
        const image = new Image()
        image.onload = () => resolve({ image, sheet, frame: DANCE_STILL_FRAME })
        image.onerror = () => reject(new Error('The character image could not be loaded.'))
        image.src = sheet.url
    })
}

/** The share card as a 1080 x 1350 PNG. The card is still drawn, without the character, if its sheet fails to load. */
export async function renderCardPng(data: CardData): Promise<Blob> {
    const canvas = document.createElement('canvas')
    canvas.width = CARD.width
    canvas.height = CARD.height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('This browser cannot draw the share picture.')
    const sprite = await loadSprite(data.character).catch(() => null)
    drawCard(ctx, buildCardLayout(data), sprite)
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('The picture could not be created.'))), 'image/png')
    })
}
