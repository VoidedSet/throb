package com.throb.model;

public class Vector3 {
    public double x, y, z;

    public Vector3(double x, double y, double z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    public double distanceTo(Vector3 v) {
        double dx = this.x - v.x,
                dy = this.y - v.y,
                dz = this.z - v.z;

        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    public Vector3 subtract(Vector3 v) {
        return new Vector3(this.x - v.x, this.y - v.y, this.z - v.z);
    }

    public Vector3 normalize() {
        double mag = Math.sqrt(x * x + y * y + z * z);
        if (mag == 0)
            return new Vector3(0, 0, 0);
        return new Vector3(x / mag, y / mag, z / mag);
    }

    // Returns a value between -1.0 and 1.0.
    // 1.0 means perfectly facing the target.
    public double dot(Vector3 v) {
        return (this.x * v.x) + (this.y * v.y) + (this.z * v.z);
    }
}
