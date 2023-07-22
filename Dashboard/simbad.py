import sys
from astroquery.simbad import Simbad
from astropy.coordinates import SkyCoord
from astropy import units as u


def main(ra, dec):
    target_coords = SkyCoord(ra, dec, unit=(u.hourangle, u.deg))

    custom_simbad = Simbad()
    custom_simbad.add_votable_fields('otype(V)', 'plx', 'rv_value', 'flux(U)', 'flux(B)', 'flux(V)')

    result_table = None
    try:
        result_table = custom_simbad.query_region(target_coords, radius=5 * u.arcmin)
    except Exception as e:
        sys.stdout.write(f"An errorSIMBAD: {str(e)}\n")
        sys.stdout.flush()

    if result_table is not None and len(result_table) > 0:
        coords_table = SkyCoord(result_table['RA'], result_table['DEC'], unit=(u.deg, u.deg))
        separations = target_coords.separation(coords_table)

        closest_idx = min(range(len(separations)), key=separations.__getitem__)

        closest_object = result_table[closest_idx]
        name = closest_object['MAIN_ID']
        obj_type = closest_object['OTYPE_V']
        parallax = closest_object['PLX_VALUE']
        radial_velocity = closest_object['RV_VALUE']
        fu = closest_object['FLUX_U']
        fb = closest_object['FLUX_B']
        fv = closest_object['FLUX_V']

        result_str = f"Object Name: {name}\n" \
                     f"Object Type: {obj_type}\n" \
                     f"RA: {ra}\n" \
                     f"DEC: {dec}\n" \
                     f"Parallax: {parallax} mas\n" \
                     f"Radial Velocity: {radial_velocity} km/s\n" \
                     f"Flux U: {fu} mag\n" \
                     f"Flux B: {fb} mag\n" \
                     f"Flux V: {fv} mag\n"
        sys.stdout.write(result_str)
        sys.stdout.flush()
    else:
        sys.stdout.write("No astronomical object found for the given coordinates.\n")
        sys.stdout.flush()

if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.stderr.write("Usage: python simbad.py <ra> <dec>\n")
        sys.exit(1)

    ra = sys.argv[1]
    dec = sys.argv[2]
    main(ra, dec)
