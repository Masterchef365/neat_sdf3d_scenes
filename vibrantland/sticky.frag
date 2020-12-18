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

SDF sdf_smooth_min(SDF sa, SDF sb) {
    float k = 1.1;
    float a = sa.dist;
    float b = sb.dist;
    float h = clamp( 0.5+0.5*(b-a)/k, 0.0, 1.0 );
    return SDF(
        mix( b, a, h ) - k*h*(1.0-h),
        //sa.dist < sb.dist ? sa.color : sb.color
        mix( sb.color, sa.color, h )
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
    return sdf_smooth_min(
        sphere(pos, vec3(xy, -1.), color, radius),
        sphere(pos, vec3(xy, 1.), color, radius)
    );
}

SDF quad(vec3 pos, float x, vec3 color, float radius) {
    return sdf_smooth_min(
        dual(pos, vec2(x, -1.), color, radius),
        dual(pos, vec2(x, 1.), color, radius)
    );
}

float rand(vec3 co){
    return fract(sin(dot(co, vec3(11.9898,78.233,24.12301))) * 438.5453);
}

vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

SDF scene(vec3 pos) {
    vec3 cellp = (pos + 1. / 2.);
    float hue = rand(vec3(ivec3(pos + 15) / 4));
    pos = fract(cellp) * 2. - 1.;
    vec3 color = hsv2rgb(vec3(hue, .8, 1));

    //const vec3 color = vec3(1.);
    const float radius = 0.5;
    return sdf_smooth_min(
        quad(pos, -1., color, radius),
        quad(pos, 1., color, radius)
    );
}

const float CLIP_NEAR = 0.1; // Near clipping sphere
const float CLIP_FAR = 1000.; // Far clipping sphere
const int MAX_STEPS = 10; // Maximum sphere steps
const vec3 BACKGROUND = vec3(0.); // Backgroudn color

void main() {
    mat4 cam_inv = inverse(camera[gl_ViewIndex]);
    vec3 origin = (cam_inv * vec4(vec3(0.), 1.)).xyz;
    vec3 ray_out = (cam_inv * vec4(fragPos.x, fragPos.y, -1., 1.)).xyz;
    vec3 unit_ray = normalize(ray_out - origin);

	vec3 color = BACKGROUND;
    vec3 pos = origin + unit_ray * CLIP_NEAR;
    float dist = 0.;
    int i;
    for (i = 0; i < MAX_STEPS; i++) {
        SDF hit = scene(pos);

        if (hit.dist < 0.3) {
            color = hit.color;
            dist = hit.dist;
            break;
        }

        if (hit.dist > CLIP_FAR) {
            color = BACKGROUND;
            dist = CLIP_FAR;
            break;
        }

        pos += unit_ray * hit.dist;
    }

    //outColor = vec4(color, 1.0);
    outColor = vec4(vec3(float(i) / MAX_STEPS), 1.0);
    //outColor = vec4(vec3(dist), 1.0);
}
