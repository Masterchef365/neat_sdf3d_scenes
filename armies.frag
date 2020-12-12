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

float rand(vec2 co){
    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

SDF sphere(vec3 pos, vec3 origin, vec3 color, float radius) {
    //float v = 0.5;
    //pos = vec3(fract(pos.x) / v, pos.y, fract(pos.z) / v);
    float seed = rand(ivec2(pos.xz / 8.));
    origin.y += fract(seed) + 1.;
    pos.xz = fract(pos.xz) * 2. - 1.;
    return SDF(
        distance(pos, origin) - radius,
        vec3(seed)
        //color
    );
}

SDF sdf_smooth_min(SDF sa, SDF sb) {
    float k = 0.3;
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

SDF scene(vec3 pos) {
    //return sdf_smooth_min(
    return sdf_min(
        sphere(pos, vec3(0., 5., 0.0), vec3(0.721,0.995,0.123), 1.0),
        sphere(pos, vec3(0., -5., 0.0), vec3(0.995,0.467,0.002), 1.0)
    );
}

const float CLIP_NEAR = 0.1; // Near clipping sphere
const float CLIP_FAR = 1000.; // Far clipping sphere
const int MAX_STEPS = 50; // Maximum sphere steps
const float HIT_THRESHOLD = 0.0001; // Minimum distance considered a hit
const vec3 BACKGROUND = vec3(0.); // Backgroudn color

void main() {
#if 1
    mat4 cam_inv = inverse(camera[gl_ViewIndex]);
    vec3 origin = (cam_inv * vec4(vec3(0.), 1.)).xyz;
    vec3 ray_out = (cam_inv * vec4(fragPos.x, fragPos.y, -1., 1.)).xyz;
    vec3 unit_ray = normalize(ray_out - origin);

	vec3 color = BACKGROUND;
    vec3 pos = origin + unit_ray * CLIP_NEAR;
    for (int i = 0; i < MAX_STEPS; i++) {
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
#else
    vec2 st = vec2(fragPos.x, -fragPos.y);
    float dist = smoothmin(st.x, st.y);
    vec3 color = vec3(dist);
#endif

    outColor = vec4(color, 1.0);
}
