#version 450
#extension GL_ARB_separate_shader_objects : enable
#extension GL_EXT_multiview : require

// IO stuff
layout(location = 0) in vec3 fragPos;
layout(location = 0) out vec4 outColor;

layout(binding = 1) uniform Animation {
    float anim;
};

layout(binding = 0) uniform CameraUbo {
    mat4 camera[2];
};

struct SDF {
    float dist;
    vec3 color;
};

SDF sphere(vec3 pos, vec3 origin, vec3 color, float radius) {
    return SDF(
        distance(pos, origin) - radius,
        color
    );
}

SDF cube(vec3 pos, vec3 origin, vec3 color, float side) {
    vec3 pt = pos - origin;
    return SDF(
        distance(pt, clamp(vec3(-side), pt, vec3(side))),
        color
    );
}

SDF sdf_min(SDF a, SDF b) {
    if (a.dist <= b.dist) {
        return a;
    } else {
        return b;
    }
}

SDF dual(vec3 pos, vec2 xy, vec3 color, float radius) {
    return sdf_min(
        sphere(pos, vec3(xy, -1.), color, radius),
        sphere(pos, vec3(xy, 1.), color, radius)
    );
}

SDF quad(vec3 pos, float x, vec3 color, float radius) {
    return sdf_min(
        dual(pos, vec2(x, -1.), color, radius),
        dual(pos, vec2(x, 1.), color, radius)
    );
}

float rand(vec3 co){
    return fract(sin(dot(co, vec3(12.9898,78.233,24.12301))) * 458.5453);
}

SDF scene(vec3 pos) {
    vec3 cellp = (pos + 1. / 2.);
    float hue = rand(vec3(ivec3(pos)));
    pos = fract(cellp) * 2. - 1.;
    vec3 color = vec3(hue);

    //const vec3 color = vec3(1.);
    const float radius = 0.5;
    return sdf_min(
        quad(pos, -1., color, radius),
        quad(pos, 1., color, radius)
    );
}

const float CLIP_NEAR = 0.1; // Near clipping sphere
const float CLIP_FAR = 1000.; // Far clipping sphere
const int MAX_STEPS = 30; // Maximum sphere steps
const float HIT_THRESHOLD = 0.001; // Minimum distance considered a hit
const vec3 BACKGROUND = vec3(0.); // Backgroudn color

void main() {
    mat4 cam_inv = inverse(camera[gl_ViewIndex]);
    vec3 origin = (cam_inv * vec4(vec3(0.), 1.)).xyz;
    vec3 ray_out = (cam_inv * vec4(fragPos.x, fragPos.y, -1., 1.)).xyz;
    vec3 unit_ray = normalize(ray_out - origin);

	vec3 color = BACKGROUND;
    vec3 pos = origin + unit_ray * CLIP_NEAR;
    int i;
    for (i = 0; i < MAX_STEPS; i++) {
        SDF hit = scene(pos);

        if (hit.dist < HIT_THRESHOLD) {
            color = hit.color;
            break;
        }

        if (hit.dist > CLIP_FAR) {
            color = BACKGROUND;
            break;
        }

        pos += unit_ray * hit.dist;
    }

    //outColor = vec4(color, 1.0);
    outColor = vec4(vec3(float(i) / MAX_STEPS * 2.), 1.0);
}
