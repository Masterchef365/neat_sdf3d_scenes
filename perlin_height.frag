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

const float PI = 3.141592;

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

// https://gist.github.com/patriciogonzalezvivo/670c22f3966e662d2f83
float rand(vec2 c){
	return fract(sin(dot(c.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

float noise(vec2 p, float freq ){
	float unit = 1./freq;
	vec2 ij = floor(p/unit);
	vec2 xy = mod(p,unit)/unit;
	//xy = 3.*xy*xy-2.*xy*xy*xy;
	xy = .5*(1.-cos(PI*xy));
	float a = rand((ij+vec2(0.,0.)));
	float b = rand((ij+vec2(1.,0.)));
	float c = rand((ij+vec2(0.,1.)));
	float d = rand((ij+vec2(1.,1.)));
	float x1 = mix(a, b, xy.x);
	float x2 = mix(c, d, xy.x);
	return mix(x1, x2, xy.y);
}

float pNoise(vec2 p, int res){
	float persistance = .5;
	float n = 0.;
	float normK = 0.;
	float f = 4.;
	float amp = 1.;
	int iCount = 0;
	for (int i = 0; i<50; i++){
		n+=amp*noise(p, f);
		f*=2.;
		normK+=amp;
		amp*=persistance;
		if (iCount == res) break;
		iCount++;
	}
	float nf = n/normK;
	return nf*nf*nf*nf;
}


SDF perlin_height(vec3 pos, int res) {
    float p = pNoise(pos.xz / 4., res);
    return SDF(
        pos.y - p,
        vec3(p)
    );
}

SDF scene(vec3 pos) {
    return perlin_height(pos, 4);
}


const float CLIP_NEAR = 0.1; // Near clipping sphere
const float CLIP_FAR = 1000.; // Far clipping sphere
const int MAX_STEPS = 50; // Maximum sphere steps
const float HIT_THRESHOLD = 0.001; // Minimum distance considered a hit
const vec3 BACKGROUND = vec3(0.); // Backgroudn color

void main() {
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

    outColor = vec4(color, 1.0);
}
