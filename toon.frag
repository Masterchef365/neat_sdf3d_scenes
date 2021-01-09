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
    vec3 normal;
};

SDF sphere(vec3 pos, vec3 origin, vec3 color, float radius) {
    return SDF(
        distance(pos, origin) - radius,
        color,
        normalize(pos - origin)
    );
}

SDF cube(vec3 pos, vec3 origin, vec3 color, float side) {
    vec3 pt = pos - origin;
    return SDF(
        distance(pt, clamp(vec3(-side), pt, vec3(side))),
        color,
        normalize(pt)
        //sign(pt - side)
    );
}

SDF sdf_smooth_min(SDF sa, SDF sb) {
    float k = 0.3;
    float a = sa.dist;
    float b = sb.dist;
    float h = clamp( 0.5+0.5*(b-a)/k, 0.0, 1.0 );
    return SDF(
        mix(b, a, h) - k*h*(1.0-h),
        //sa.dist < sb.dist ? sa.color : sb.color
        mix(sb.color, sa.color, h),
        //sa.dist < sb.dist ? sa.normal : sb.normal
        normalize(mix(sb.normal, sa.normal, h))
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
    return sdf_smooth_min(
        cube(pos, vec3(0.168, cos(anim / 2.), 0.800), vec3(0.721,0.995,0.123), 0.5),
        sphere(pos, vec3(0., 0.860, 0.776), vec3(0.995,0.467,0.002), 0.5)
    );
}

const float CLIP_NEAR = 0.1; // Near clipping sphere
const float CLIP_FAR = 1000.; // Far clipping sphere
const int MAX_STEPS = 50; // Maximum sphere steps
const float HIT_THRESHOLD = 0.001; // Minimum distance considered a hit
const vec3 BACKGROUND = vec3(0.); // Backgroudn color

void main() {
    mat4 cam_inv = camera[gl_ViewIndex];
    vec3 origin = (cam_inv * vec4(vec3(0.), 1.)).xyz;
    vec3 ray_out = (cam_inv * vec4(fragPos.x, fragPos.y, -1., 1.)).xyz;
    vec3 unit_ray = normalize(ray_out - origin);

    //vec3 light = vec3(4., 5. * cos(anim), 6.);
    const vec3 light = vec3(4., 5., 6.);
    const vec3 ambient = vec3(.1, .2, .3) * .3;

	vec3 color = BACKGROUND;
    vec3 pos = origin + unit_ray * CLIP_NEAR;
    for (int i = 0; i < MAX_STEPS; i++) {
        SDF hit = scene(pos);

        if (hit.dist < HIT_THRESHOLD) {
            vec3 lm = normalize(light - pos);
            vec3 rf = reflect(lm, hit.normal);
            float diffuse = dot(lm, hit.normal);
            float specular = pow(max(dot(rf, unit_ray), 0.), 90.);

            const float m = 3.;
            diffuse = float(int(diffuse * m)) / m;
            specular = float(specular > 0.5);

            color = ambient + 
                hit.color * diffuse +
                vec3(1.) * specular;
            //color = hit.normal;
            break;
        }

        if (hit.dist > CLIP_FAR) {
            color = BACKGROUND;
            break;
        }

        pos += unit_ray * hit.dist;
    }

    outColor = vec4(color, 1.0);
}
