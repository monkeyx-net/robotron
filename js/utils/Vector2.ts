/**
 * 2D Vector utility class for position, velocity, and direction calculations
 */
export class Vector2 {
    public x: number;
    public y: number;

    constructor(x: number = 0, y: number = 0) {
        this.x = x;
        this.y = y;
    }

    /**
     * Create a new Vector2 from this one
     */
    clone(): Vector2 {
        return new Vector2(this.x, this.y);
    }

    /**
     * Copy values from another vector
     */
    copy(other: Vector2): Vector2 {
        this.x = other.x;
        this.y = other.y;
        return this;
    }

    /**
     * Set the vector components
     */
    set(x: number, y: number): Vector2 {
        this.x = x;
        this.y = y;
        return this;
    }

    /**
     * Add another vector to this one
     */
    add(other: Vector2): Vector2 {
        this.x += other.x;
        this.y += other.y;
        return this;
    }

    /**
     * Subtract another vector from this one
     */
    subtract(other: Vector2): Vector2 {
        this.x -= other.x;
        this.y -= other.y;
        return this;
    }

    /**
     * Multiply this vector by a scalar
     */
    multiply(scalar: number): Vector2 {
        this.x *= scalar;
        this.y *= scalar;
        return this;
    }

    /**
     * Divide this vector by a scalar
     */
    divide(scalar: number): Vector2 {
        if (scalar !== 0) {
            this.x /= scalar;
            this.y /= scalar;
        }
        return this;
    }

    /**
     * Get the magnitude (length) of this vector
     */
    magnitude(): number {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    /**
     * Get the squared magnitude (more efficient when you don't need the actual distance)
     */
    magnitudeSquared(): number {
        return this.x * this.x + this.y * this.y;
    }

    /**
     * Normalize this vector (make it unit length)
     */
    normalize(): Vector2 {
        const mag = this.magnitude();
        if (mag > 0) {
            this.divide(mag);
        }
        return this;
    }

    /**
     * Get a normalized copy of this vector
     */
    normalized(): Vector2 {
        return this.clone().normalize();
    }

    /**
     * Calculate distance to another vector
     */
    distanceTo(other: Vector2): number {
        const dx = this.x - other.x;
        const dy = this.y - other.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Calculate squared distance to another vector (more efficient)
     */
    distanceSquaredTo(other: Vector2): number {
        const dx = this.x - other.x;
        const dy = this.y - other.y;
        return dx * dx + dy * dy;
    }

    /**
     * Calculate angle to another vector in radians
     */
    angleTo(other: Vector2): number {
        return Math.atan2(other.y - this.y, other.x - this.x);
    }

    /**
     * Get the dot product with another vector
     */
    dot(other: Vector2): number {
        return this.x * other.x + this.y * other.y;
    }

    /**
     * Get the cross product with another vector (returns scalar in 2D)
     */
    cross(other: Vector2): number {
        return this.x * other.y - this.y * other.x;
    }

    /**
     * Rotate this vector by the given angle in radians
     */
    rotate(angle: number): Vector2 {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const newX = this.x * cos - this.y * sin;
        const newY = this.x * sin + this.y * cos;
        this.x = newX;
        this.y = newY;
        return this;
    }

    /**
     * Limit the magnitude of this vector to the given maximum
     */
    limit(max: number): Vector2 {
        const mag = this.magnitude();
        if (mag > max) {
            this.normalize().multiply(max);
        }
        return this;
    }

    /**
     * Linear interpolation between this vector and another
     */
    lerp(other: Vector2, t: number): Vector2 {
        this.x += (other.x - this.x) * t;
        this.y += (other.y - this.y) * t;
        return this;
    }

    /**
     * Check if this vector equals another vector (within tolerance)
     */
    equals(other: Vector2, tolerance: number = 0.0001): boolean {
        return Math.abs(this.x - other.x) < tolerance && Math.abs(this.y - other.y) < tolerance;
    }

    /**
     * Convert to string representation
     */
    toString(): string {
        return `Vector2(${this.x.toFixed(2)}, ${this.y.toFixed(2)})`;
    }

    // Static utility methods
    static zero(): Vector2 {
        return new Vector2(0, 0);
    }

    static one(): Vector2 {
        return new Vector2(1, 1);
    }

    static up(): Vector2 {
        return new Vector2(0, -1);
    }

    static down(): Vector2 {
        return new Vector2(0, 1);
    }

    static left(): Vector2 {
        return new Vector2(-1, 0);
    }

    static right(): Vector2 {
        return new Vector2(1, 0);
    }

    /**
     * Create a vector from an angle and magnitude
     */
    static fromAngle(angle: number, magnitude: number = 1): Vector2 {
        return new Vector2(Math.cos(angle) * magnitude, Math.sin(angle) * magnitude);
    }

    /**
     * Linear interpolation between two vectors
     */
    static lerp(a: Vector2, b: Vector2, t: number): Vector2 {
        return new Vector2(
            a.x + (b.x - a.x) * t,
            a.y + (b.y - a.y) * t
        );
    }

    /**
     * Distance between two vectors
     */
    static distance(a: Vector2, b: Vector2): number {
        return a.distanceTo(b);
    }

    /**
     * Angle between two vectors
     */
    static angle(a: Vector2, b: Vector2): number {
        return a.angleTo(b);
    }
}