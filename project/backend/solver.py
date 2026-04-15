import numpy as np
from scipy.optimize import least_squares

# Geometry

def compute_AB(r1, r2, r3, r4, O2, O4, theta):
    A= O2 + r2 * np.array([np.cos(theta), np.sin(theta)])

    dx= O4[0]-A[0]
    dy= O4[1]-A[1]
    d= np.hypot(dx, dy)

    if d>(r3+r4) or d<abs(r3-r4) or d==0:
        return None, None

    a= (r3**2-r4**2+d**2)/(2*d)
    h_sq= r3**2-a**2
    if h_sq < 0:
        return None, None

    h= np.sqrt(h_sq)

    xm= A[0]+a*dx/d
    ym= A[1]+a*dy/d

    xb= xm-h*dy/d
    yb= ym+h*dx/d

    return A, np.array([xb,yb])

# Residual (Burmester condition)

def residual(params, targets):

    r1,r2, r3,r4, x0, y0,theta_g, t, h = params

    O2= np.array([x0,y0])
    O4= O2+r1*np.array([np.cos(theta_g), np.sin(theta_g)])

    thetas= np.linspace(0, 2*np.pi,90)

    C_list= []

    for th in thetas:
        A,B= compute_AB(r1, r2,r3, r4,O2,O4, th)
        if A is None:
            continue

        AB= B-A
        L= np.linalg.norm(AB)
        if L==0:
            continue

        perp= np.array([-AB[1], AB[0]])/L
        C= A+t*AB+h*perp
        C_list.append(C)

    if len(C_list)<20:
        return np.ones(len(targets)) * 10

    C_arr= np.array(C_list)

    res= []
    for p in targets:
        d= np.linalg.norm(C_arr - p, axis=1)
        res.append(np.min(d))

    return np.array(res)

# MAIN SOLVER

def generate_mechanism(points):

    pts= np.array(points, dtype=float)

    centroid= np.mean(pts, axis=0)
    scale= np.max(np.linalg.norm(pts-centroid, axis=1)) + 1e-6
    pts_n= (pts - centroid)/scale

    best= None
    best_err= 1e9

    # global random initialization
    for _ in range(20):

        x0,y0 = np.random.uniform(-1.5, 1.5, 2)

        params0 = [
            np.random.uniform(0.5, 3.0),  # r1
            np.random.uniform(0.5, 3.0),  # r2
            np.random.uniform(0.5, 3.0),  # r3
            np.random.uniform(0.5, 3.0),  # r4
            x0, y0,
            np.random.uniform(0, 2*np.pi),
            np.random.uniform(0.3, 0.7),
            np.random.uniform(0.2, 0.6),
        ]

        try:
            sol= least_squares(
                residual,
                params0,
                args=(pts_n,),
                max_nfev=100
            )
        except:
            continue

        err= np.sum(sol.fun**2)

        if err<best_err:
            best_err= err
            best= sol.x

    if best is None:
        return {"frames": [], "error": "No solution"}

    r1, r2, r3, r4, x0, y0, theta_g, t, h = best

    O2= np.array([x0, y0])
    O4= O2+r1*np.array([np.cos(theta_g), np.sin(theta_g)])

    frames= []
    angles= np.linspace(0, 2*np.pi, 90)

    for th in angles:
        A,B = compute_AB(r1,r2, r3, r4, O2, O4, th)
        if A is None:
            continue

        AB= B-A
        L= np.linalg.norm(AB)
        if L==0:
            continue

        perp= np.array([-AB[1],AB[0]])/L
        C= A+t*AB+h*perp

        # --- triangle lengths ---
        AC= np.linalg.norm(C-A)
        BC= np.linalg.norm(C-B)
        AB= np.linalg.norm(B-A)

        # --- triangle angles (in degrees) ---
        # angle at A
        angle_A= np.degrees(np.arccos(
            np.clip(np.dot(B-A, C-A) / (AB*AC + 1e-9), -1, 1)
        ))

        # angle at B
        angle_B= np.degrees(np.arccos(
            np.clip(np.dot(A-B, C-B) / (AB*BC + 1e-9), -1, 1)
        ))

        frames.append({
            "A": (A*scale + centroid).tolist(),
            "B": (B*scale + centroid).tolist(),
            "C": (C*scale + centroid).tolist(),

            "AC": float(AC*scale),
            "BC": float(BC*scale),
            "angle_A": float(angle_A),
            "angle_B": float(angle_B)
        })

    real_links = [
        float(r1* scale),
        float(r2* scale),
        float(r3* scale),
        float(r4* scale)
    ]
    
    ground_length= float(np.linalg.norm(O2-O4)*scale)

    
    return {
    "frames": frames,
    "O2": (O2*scale + centroid).tolist(),
    "O4": (O4*scale + centroid).tolist(),
    "params": best.tolist(),
    "error": float(best_err * scale),
    "scale": float(scale),
    "centroid": centroid.tolist(),
    "real_links": {
        "ground": float(r1* scale),
        "crank": float(r2* scale),
        "coupler": float(r3* scale),
        "rocker": float(r4* scale)
    },
    "ground_length": ground_length
}