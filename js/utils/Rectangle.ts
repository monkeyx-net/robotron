import { Vector2 } from './Vector2';

/**
 * Rectangle utility class for bounding boxes and collision detection
 */
export class Rectangle {
    public x: number;
    public y: number;
    public width: number;
    public height: number;

    constructor(x: number = 0, y: number = 0, width: number = 0, height: number = 0) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }

    /**
     * Get the left edge of the rectangle
     */
    get left(): number {
        return this.x;
    }

    /**
     * Get the right edge of the rectangle
     */
    get right(): number {
        return this.x + this.width;
    }

    /**
     * Get the top edge of the rectangle
     */
    get top(): number {
        return this.y;
    }

    /**
     * Get the bottom edge of the rectangle
     */
    get bottom(): number {
        return this.y + this.height;
    }

    /**
     * Get the center point of the rectangle
     */
    get center(): Vector2 {
        return new Vector2(this.x + this.width / 2, this.y + this.height / 2);
    }

    /**
     * Create a copy of this rectangle
     */
    clone(): Rectangle {
        return new Rectangle(this.x, this.y, this.width, this.height);
    }

    /**
     * Copy values from another rectangle
     */
    copy(other: Rectangle): Rectangle {
        this.x = other.x;
        this.y = other.y;
        this.width = other.width;
        this.height = other.height;
        return this;
    }

    /**
     * Set the rectangle properties
     */
    set(x: number, y: number, width: number, height: number): Rectangle {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        return this;
    }

    /**
     * Check if this rectangle intersects with another rectangle
     */
    intersects(other: Rectangle): boolean {
        return !(this.right < other.left || 
                this.left > other.right || 
                this.bottom < other.top || 
                this.top > other.bottom);
    }

    /**
     * Check if this rectangle completely contains another rectangle
     */
    contains(other: Rectangle): boolean {
        return this.left <= other.left &&
               this.right >= other.right &&
               this.top <= other.top &&
               this.bottom >= other.bottom;
    }

    /**
     * Check if this rectangle contains a point
     */
    containsPoint(point: Vector2): boolean {
        return point.x >= this.left &&
               point.x <= this.right &&
               point.y >= this.top &&
               point.y <= this.bottom;
    }

    /**
     * Get the area of the rectangle
     */
    area(): number {
        return this.width * this.height;
    }

    /**
     * Get the perimeter of the rectangle
     */
    perimeter(): number {
        return 2 * (this.width + this.height);
    }

    /**
     * Expand the rectangle by the given amount in all directions
     */
    expand(amount: number): Rectangle {
        this.x -= amount;
        this.y -= amount;
        this.width += amount * 2;
        this.height += amount * 2;
        return this;
    }

    /**
     * Contract the rectangle by the given amount in all directions
     */
    contract(amount: number): Rectangle {
        return this.expand(-amount);
    }

    /**
     * Move the rectangle by the given offset
     */
    translate(offset: Vector2): Rectangle {
        this.x += offset.x;
        this.y += offset.y;
        return this;
    }

    /**
     * Scale the rectangle by the given factor
     */
    scale(factor: number): Rectangle {
        const center = this.center;
        this.width *= factor;
        this.height *= factor;
        this.x = center.x - this.width / 2;
        this.y = center.y - this.height / 2;
        return this;
    }

    /**
     * Get the intersection rectangle with another rectangle
     */
    intersection(other: Rectangle): Rectangle | null {
        if (!this.intersects(other)) {
            return null;
        }

        const left = Math.max(this.left, other.left);
        const right = Math.min(this.right, other.right);
        const top = Math.max(this.top, other.top);
        const bottom = Math.min(this.bottom, other.bottom);

        return new Rectangle(left, top, right - left, bottom - top);
    }

    /**
     * Get the union rectangle with another rectangle
     */
    union(other: Rectangle): Rectangle {
        const left = Math.min(this.left, other.left);
        const right = Math.max(this.right, other.right);
        const top = Math.min(this.top, other.top);
        const bottom = Math.max(this.bottom, other.bottom);

        return new Rectangle(left, top, right - left, bottom - top);
    }

    /**
     * Check if this rectangle equals another rectangle (within tolerance)
     */
    equals(other: Rectangle, tolerance: number = 0.0001): boolean {
        return Math.abs(this.x - other.x) < tolerance &&
               Math.abs(this.y - other.y) < tolerance &&
               Math.abs(this.width - other.width) < tolerance &&
               Math.abs(this.height - other.height) < tolerance;
    }

    /**
     * Convert to string representation
     */
    toString(): string {
        return `Rectangle(${this.x.toFixed(2)}, ${this.y.toFixed(2)}, ${this.width.toFixed(2)}, ${this.height.toFixed(2)})`;
    }

    // Static utility methods
    static zero(): Rectangle {
        return new Rectangle(0, 0, 0, 0);
    }

    /**
     * Create a rectangle from two points
     */
    static fromPoints(point1: Vector2, point2: Vector2): Rectangle {
        const left = Math.min(point1.x, point2.x);
        const top = Math.min(point1.y, point2.y);
        const right = Math.max(point1.x, point2.x);
        const bottom = Math.max(point1.y, point2.y);

        return new Rectangle(left, top, right - left, bottom - top);
    }

    /**
     * Create a rectangle centered at the given point
     */
    static centered(center: Vector2, width: number, height: number): Rectangle {
        return new Rectangle(
            center.x - width / 2,
            center.y - height / 2,
            width,
            height
        );
    }
}