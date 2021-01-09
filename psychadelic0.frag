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

// SDF stuff
struct SDF {
    float dist;
    vec3 color;
};

#include <sphere.frag>

mat4 rotation3d(vec3 axis, float angle) {
  axis = normalize(axis);
  float s = sin(angle);
  float c = cos(angle);
  float oc = 1.0 - c;

  return mat4(
		oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,  0.0,
    oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,  0.0,
    oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c,           0.0,
		0.0,                                0.0,                                0.0,                                1.0
	);
}

SDF cube(vec3 pos, vec3 origin, vec3 color, float side) {
    vec3 pt = pos - origin;
    vec3 axis = vec3(1., 1., 1.);
    float angle = anim;
    mat4 rot = rotation3d(axis, dot(axis, pt) * 2.);
    pt = (vec4(pt, 1.) * rot).xyz;

    return SDF(
        distance(pt, clamp(vec3(-side), pt, vec3(side))),
        pt
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
    return cube(pos, vec3(0., 0.460, (0.776)), vec3(0.995,0.467,0.002), 0.5);
    /*
    return sdf_min(
        sphere(pos, vec3(0.168, 0.088, (0.800)), vec3(0.721,0.995,0.123), 0.8),
    );
    */
}

void main() {
    mat4 cam_inv = camera[gl_ViewIndex];
    vec3 origin = (cam_inv * vec4(vec3(0.), 1.)).xyz;
    vec3 ray_out = (cam_inv * vec4(fragPos.x, fragPos.y, -1., 1.)).xyz;

    vec3 unit_ray = normalize(ray_out - origin);
	vec3 color = vec3(0.);
    
    vec3 pos = origin + unit_ray * 0.1;
    for (int i = 0; i < 50; i++) {
        SDF hit = scene(pos);
        if (hit.dist < 0.001 || hit.dist > 10.) {
            color = hit.color;
            break;
        }
        pos += unit_ray * hit.dist;
    }

    outColor = vec4(color, 1.0);
}
