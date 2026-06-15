import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Full revert: restores targetStock, minimumStock, reorderPoint for all articles
 * to the exact values from the DB dump of 2026-06-15 (before today's migrations ran).
 * Also restores the stock_level for 6LK49135000 from 9 back to 11.
 */
export class FullRevertToPreMigrationState1746600000003 implements MigrationInterface {
  name = "FullRevertToPreMigrationState1746600000003";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE items SET targetStock=3, minimumStock=3, reorderPoint=3, updatedAt=NOW() WHERE code='12100156T'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=0, reorderPoint=0, updatedAt=NOW() WHERE code='6LK48919000'`);
    await queryRunner.query(`UPDATE items SET targetStock=1, minimumStock=2, reorderPoint=1, updatedAt=NOW() WHERE code='C0-14573000'`);
    await queryRunner.query(`UPDATE items SET targetStock=2, minimumStock=4, reorderPoint=2, updatedAt=NOW() WHERE code='AAJW250'`);
    await queryRunner.query(`UPDATE items SET targetStock=1, minimumStock=1, reorderPoint=1, updatedAt=NOW() WHERE code='66084999'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=0, reorderPoint=0, updatedAt=NOW() WHERE code='6LJ54009100'`);
    await queryRunner.query(`UPDATE items SET targetStock=8, minimumStock=20, reorderPoint=8, updatedAt=NOW() WHERE code='6LJ54099000'`);
    await queryRunner.query(`UPDATE items SET targetStock=3, minimumStock=3, reorderPoint=3, updatedAt=NOW() WHERE code='418135'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=0, reorderPoint=0, updatedAt=NOW() WHERE code='6LH56319000'`);
    await queryRunner.query(`UPDATE items SET targetStock=10, minimumStock=10, reorderPoint=10, updatedAt=NOW() WHERE code='6LK50755000'`);
    await queryRunner.query(`UPDATE items SET targetStock=2, minimumStock=1, reorderPoint=2, updatedAt=NOW() WHERE code='6LA08932000'`);
    await queryRunner.query(`UPDATE items SET targetStock=1, minimumStock=3, reorderPoint=1, updatedAt=NOW() WHERE code='6LJ55537000'`);
    await queryRunner.query(`UPDATE items SET targetStock=1, minimumStock=1, reorderPoint=1, updatedAt=NOW() WHERE code='6LJ83405000'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=0, reorderPoint=0, updatedAt=NOW() WHERE code='ST45037701'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=0, reorderPoint=0, updatedAt=NOW() WHERE code='6LA84930000'`);
    await queryRunner.query(`UPDATE items SET targetStock=2, minimumStock=2, reorderPoint=2, updatedAt=NOW() WHERE code='6LK45855000'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=0, reorderPoint=0, updatedAt=NOW() WHERE code='6LL15823200'`);
    await queryRunner.query(`UPDATE items SET targetStock=2, minimumStock=2, reorderPoint=2, updatedAt=NOW() WHERE code='C0-16187000 B'`);
    await queryRunner.query(`UPDATE items SET targetStock=1, minimumStock=1, reorderPoint=1, updatedAt=NOW() WHERE code='6B000000619'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=0, reorderPoint=0, updatedAt=NOW() WHERE code='H556-2210'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=0, reorderPoint=0, updatedAt=NOW() WHERE code='6LA34352000'`);
    await queryRunner.query(`UPDATE items SET targetStock=10, minimumStock=10, reorderPoint=2, updatedAt=NOW() WHERE code='6LK48906000'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=0, reorderPoint=0, updatedAt=NOW() WHERE code='X0-02247000'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=0, reorderPoint=0, updatedAt=NOW() WHERE code='6LE58611000'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=0, reorderPoint=0, updatedAt=NOW() WHERE code='6LL48474000'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=0, reorderPoint=0, updatedAt=NOW() WHERE code='6LJ76514000'`);
    await queryRunner.query(`UPDATE items SET targetStock=1, minimumStock=1, reorderPoint=1, updatedAt=NOW() WHERE code='6LA81707000'`);
    await queryRunner.query(`UPDATE items SET targetStock=2, minimumStock=2, reorderPoint=2, updatedAt=NOW() WHERE code='6A000001533'`);
    await queryRunner.query(`UPDATE items SET targetStock=8, minimumStock=4, reorderPoint=4, updatedAt=NOW() WHERE code='6LK49015000'`);
    await queryRunner.query(`UPDATE items SET targetStock=3, minimumStock=2, reorderPoint=3, updatedAt=NOW() WHERE code='6LH57304000'`);
    await queryRunner.query(`UPDATE items SET targetStock=1, minimumStock=1, reorderPoint=1, updatedAt=NOW() WHERE code='6LH53737000'`);
    await queryRunner.query(`UPDATE items SET targetStock=1, minimumStock=1, reorderPoint=1, updatedAt=NOW() WHERE code='6LK72101000'`);
    await queryRunner.query(`UPDATE items SET targetStock=2, minimumStock=4, reorderPoint=2, updatedAt=NOW() WHERE code='6LJ55574000'`);
    await queryRunner.query(`UPDATE items SET targetStock=5, minimumStock=5, reorderPoint=5, updatedAt=NOW() WHERE code='6LK48908000'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=0, reorderPoint=0, updatedAt=NOW() WHERE code='6LH03541000'`);
    await queryRunner.query(`UPDATE items SET targetStock=2, minimumStock=3, reorderPoint=2, updatedAt=NOW() WHERE code='AF03-1103'`);
    await queryRunner.query(`UPDATE items SET targetStock=4, minimumStock=8, reorderPoint=4, updatedAt=NOW() WHERE code='6LJ55445000'`);
    await queryRunner.query(`UPDATE items SET targetStock=1, minimumStock=3, reorderPoint=1, updatedAt=NOW() WHERE code='6LK52274000'`);
    await queryRunner.query(`UPDATE items SET targetStock=1, minimumStock=1, reorderPoint=1, updatedAt=NOW() WHERE code='6LH53424000'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=0, reorderPoint=0, updatedAt=NOW() WHERE code='6LH51422000'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=0, reorderPoint=0, updatedAt=NOW() WHERE code='6LH54079100'`);
    await queryRunner.query(`UPDATE items SET targetStock=4, minimumStock=10, reorderPoint=4, updatedAt=NOW() WHERE code='C0-17839000'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=0, reorderPoint=0, updatedAt=NOW() WHERE code='6LH64641000'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=0, reorderPoint=0, updatedAt=NOW() WHERE code='6LH54062000'`);
    await queryRunner.query(`UPDATE items SET targetStock=2, minimumStock=2, reorderPoint=2, updatedAt=NOW() WHERE code='1T02T60UT0001'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=0, reorderPoint=0, updatedAt=NOW() WHERE code='6LH51628000'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=0, reorderPoint=0, updatedAt=NOW() WHERE code='B044-4851'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=0, reorderPoint=0, updatedAt=NOW() WHERE code='6LH51415000'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=0, reorderPoint=0, updatedAt=NOW() WHERE code='6LJ13409000'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=0, reorderPoint=0, updatedAt=NOW() WHERE code='6LA84944200'`);
    await queryRunner.query(`UPDATE items SET targetStock=2, minimumStock=4, reorderPoint=2, updatedAt=NOW() WHERE code='6LJ58890000'`);
    await queryRunner.query(`UPDATE items SET targetStock=1, minimumStock=1, reorderPoint=1, updatedAt=NOW() WHERE code='6LA88500000'`);
    await queryRunner.query(`UPDATE items SET targetStock=8, minimumStock=4, reorderPoint=8, updatedAt=NOW() WHERE code='6LL43424000'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=0, reorderPoint=0, updatedAt=NOW() WHERE code='6LE50494000'`);
    await queryRunner.query(`UPDATE items SET targetStock=2, minimumStock=2, reorderPoint=2, updatedAt=NOW() WHERE code='6LK48768000'`);
    await queryRunner.query(`UPDATE items SET targetStock=15, minimumStock=25, reorderPoint=15, updatedAt=NOW() WHERE code='6AG00007695'`);
    await queryRunner.query(`UPDATE items SET targetStock=2, minimumStock=2, reorderPoint=2, updatedAt=NOW() WHERE code='6LL43305100'`);
    await queryRunner.query(`UPDATE items SET targetStock=1, minimumStock=3, reorderPoint=1, updatedAt=NOW() WHERE code='6LJ55562100'`);
    await queryRunner.query(`UPDATE items SET targetStock=1, minimumStock=1, reorderPoint=1, updatedAt=NOW() WHERE code='AF03-2030'`);
    await queryRunner.query(`UPDATE items SET targetStock=1, minimumStock=1, reorderPoint=1, updatedAt=NOW() WHERE code='6A000000706'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=0, reorderPoint=0, updatedAt=NOW() WHERE code='6LJ54161000'`);
    await queryRunner.query(`UPDATE items SET targetStock=1, minimumStock=1, reorderPoint=1, updatedAt=NOW() WHERE code='6AJ00000097'`);
    await queryRunner.query(`UPDATE items SET targetStock=2, minimumStock=2, reorderPoint=2, updatedAt=NOW() WHERE code='6LJ54196000'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=0, reorderPoint=0, updatedAt=NOW() WHERE code='6LH25001000'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=0, reorderPoint=0, updatedAt=NOW() WHERE code='6LH55290100'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=0, reorderPoint=0, updatedAt=NOW() WHERE code='6LJ57811000'`);
    await queryRunner.query(`UPDATE items SET targetStock=1, minimumStock=1, reorderPoint=1, updatedAt=NOW() WHERE code='6B000000980'`);
    await queryRunner.query(`UPDATE items SET targetStock=1, minimumStock=1, reorderPoint=1, updatedAt=NOW() WHERE code='6LA81769000'`);
    await queryRunner.query(`UPDATE items SET targetStock=3, minimumStock=2, reorderPoint=3, updatedAt=NOW() WHERE code='6LK56853000'`);
    await queryRunner.query(`UPDATE items SET targetStock=1, minimumStock=1, reorderPoint=1, updatedAt=NOW() WHERE code='6LJ55967000'`);
    await queryRunner.query(`UPDATE items SET targetStock=1, minimumStock=1, reorderPoint=1, updatedAt=NOW() WHERE code='B044-3461'`);
    await queryRunner.query(`UPDATE items SET targetStock=2, minimumStock=2, reorderPoint=2, updatedAt=NOW() WHERE code='6LK54188000'`);
    await queryRunner.query(`UPDATE items SET targetStock=2, minimumStock=3, reorderPoint=2, updatedAt=NOW() WHERE code='6A000001530'`);
    await queryRunner.query(`UPDATE items SET targetStock=3, minimumStock=3, reorderPoint=3, updatedAt=NOW() WHERE code='6B000000920'`);
    await queryRunner.query(`UPDATE items SET targetStock=3, minimumStock=5, reorderPoint=3, updatedAt=NOW() WHERE code='1T02S50UT0'`);
    await queryRunner.query(`UPDATE items SET targetStock=2, minimumStock=2, reorderPoint=2, updatedAt=NOW() WHERE code='6LJ54273000'`);
    await queryRunner.query(`UPDATE items SET targetStock=1, minimumStock=1, reorderPoint=1, updatedAt=NOW() WHERE code='6LK67001000'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=0, reorderPoint=0, updatedAt=NOW() WHERE code='6LA84018000'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=0, reorderPoint=0, updatedAt=NOW() WHERE code='92F994062'`);
    await queryRunner.query(`UPDATE items SET targetStock=2, minimumStock=2, reorderPoint=2, updatedAt=NOW() WHERE code='6LH53434000'`);
    await queryRunner.query(`UPDATE items SET targetStock=1, minimumStock=1, reorderPoint=1, updatedAt=NOW() WHERE code='AE04-4059'`);
    await queryRunner.query(`UPDATE items SET targetStock=1, minimumStock=5, reorderPoint=1, updatedAt=NOW() WHERE code='6LL42620000'`);
    await queryRunner.query(`UPDATE items SET targetStock=1, minimumStock=1, reorderPoint=1, updatedAt=NOW() WHERE code='6LK12912100'`);
    await queryRunner.query(`UPDATE items SET targetStock=2, minimumStock=2, reorderPoint=2, updatedAt=NOW() WHERE code='6LH53414000'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=0, reorderPoint=0, updatedAt=NOW() WHERE code='6LK48740000'`);
    await queryRunner.query(`UPDATE items SET targetStock=2, minimumStock=2, reorderPoint=2, updatedAt=NOW() WHERE code='6LH53454000'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=0, reorderPoint=0, updatedAt=NOW() WHERE code='6LA81887000'`);
    await queryRunner.query(`UPDATE items SET targetStock=1, minimumStock=4, reorderPoint=1, updatedAt=NOW() WHERE code='6LH55245000'`);
    await queryRunner.query(`UPDATE items SET targetStock=2, minimumStock=3, reorderPoint=2, updatedAt=NOW() WHERE code='6LJ56863000'`);
    await queryRunner.query(`UPDATE items SET targetStock=1, minimumStock=1, reorderPoint=1, updatedAt=NOW() WHERE code='6LH58426000'`);
    await queryRunner.query(`UPDATE items SET targetStock=5, minimumStock=4, reorderPoint=5, updatedAt=NOW() WHERE code='6LJ58963000'`);
    await queryRunner.query(`UPDATE items SET targetStock=1, minimumStock=1, reorderPoint=1, updatedAt=NOW() WHERE code='6LH54006000 A'`);
    await queryRunner.query(`UPDATE items SET targetStock=2, minimumStock=2, reorderPoint=2, updatedAt=NOW() WHERE code='6B000001422'`);
    await queryRunner.query(`UPDATE items SET targetStock=1, minimumStock=1, reorderPoint=1, updatedAt=NOW() WHERE code='6LH57315000'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=0, reorderPoint=0, updatedAt=NOW() WHERE code='AF02-2142'`);
    await queryRunner.query(`UPDATE items SET targetStock=1, minimumStock=1, reorderPoint=1, updatedAt=NOW() WHERE code='6B000000976'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=0, reorderPoint=0, updatedAt=NOW() WHERE code='AAJV0HD'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=0, reorderPoint=0, updatedAt=NOW() WHERE code='6LE71621000'`);
    await queryRunner.query(`UPDATE items SET targetStock=2, minimumStock=1, reorderPoint=2, updatedAt=NOW() WHERE code='6LJ58795000'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=0, reorderPoint=0, updatedAt=NOW() WHERE code='6LH49563000'`);
    await queryRunner.query(`UPDATE items SET targetStock=2, minimumStock=3, reorderPoint=2, updatedAt=NOW() WHERE code='6LE90507000'`);
    await queryRunner.query(`UPDATE items SET targetStock=5, minimumStock=5, reorderPoint=5, updatedAt=NOW() WHERE code='1T02 TV0 UT0'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=0, reorderPoint=0, updatedAt=NOW() WHERE code='6LH53793000'`);
    await queryRunner.query(`UPDATE items SET targetStock=1, minimumStock=1, reorderPoint=1, updatedAt=NOW() WHERE code='6LE50345000'`);
    await queryRunner.query(`UPDATE items SET targetStock=2, minimumStock=2, reorderPoint=2, updatedAt=NOW() WHERE code='6LE68394000'`);
    await queryRunner.query(`UPDATE items SET targetStock=1, minimumStock=1, reorderPoint=1, updatedAt=NOW() WHERE code='D0A4-1075'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=0, reorderPoint=0, updatedAt=NOW() WHERE code='6LA81753000'`);
    await queryRunner.query(`UPDATE items SET targetStock=3, minimumStock=5, reorderPoint=3, updatedAt=NOW() WHERE code='6LA27845000'`);
    await queryRunner.query(`UPDATE items SET targetStock=2, minimumStock=2, reorderPoint=2, updatedAt=NOW() WHERE code='6LK49473000'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=0, reorderPoint=0, updatedAt=NOW() WHERE code='41319175000'`);
    await queryRunner.query(`UPDATE items SET targetStock=6, minimumStock=10, reorderPoint=6, updatedAt=NOW() WHERE code='6AJ00000347'`);
    await queryRunner.query(`UPDATE items SET targetStock=1, minimumStock=1, reorderPoint=1, updatedAt=NOW() WHERE code='6B000000747'`);
    await queryRunner.query(`UPDATE items SET targetStock=2, minimumStock=3, reorderPoint=2, updatedAt=NOW() WHERE code='6LL15848000'`);
    await queryRunner.query(`UPDATE items SET targetStock=4, minimumStock=4, reorderPoint=4, updatedAt=NOW() WHERE code='6LH51224000'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=0, reorderPoint=0, updatedAt=NOW() WHERE code='6LA65683000'`);
    await queryRunner.query(`UPDATE items SET targetStock=8, minimumStock=15, reorderPoint=8, updatedAt=NOW() WHERE code='6LK48944000'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=0, reorderPoint=0, updatedAt=NOW() WHERE code='6LH05707000'`);
    await queryRunner.query(`UPDATE items SET targetStock=15, minimumStock=15, reorderPoint=15, updatedAt=NOW() WHERE code='6LL43324000'`);
    await queryRunner.query(`UPDATE items SET targetStock=5, minimumStock=5, reorderPoint=5, updatedAt=NOW() WHERE code='6B000000922'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=0, reorderPoint=0, updatedAt=NOW() WHERE code='6LK51421000'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=0, reorderPoint=0, updatedAt=NOW() WHERE code='H556-2201'`);
    await queryRunner.query(`UPDATE items SET targetStock=2, minimumStock=4, reorderPoint=2, updatedAt=NOW() WHERE code='44201492000 A'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=0, reorderPoint=0, updatedAt=NOW() WHERE code='B044-4118'`);
    await queryRunner.query(`UPDATE items SET targetStock=2, minimumStock=4, reorderPoint=2, updatedAt=NOW() WHERE code='AAJW350'`);
    await queryRunner.query(`UPDATE items SET targetStock=2, minimumStock=3, reorderPoint=2, updatedAt=NOW() WHERE code='6LK49094300'`);
    await queryRunner.query(`UPDATE items SET targetStock=2, minimumStock=1, reorderPoint=2, updatedAt=NOW() WHERE code='6LJ78040000'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=0, reorderPoint=0, updatedAt=NOW() WHERE code='6B000000754'`);
    await queryRunner.query(`UPDATE items SET targetStock=1, minimumStock=1, reorderPoint=1, updatedAt=NOW() WHERE code='6A000000041'`);
    await queryRunner.query(`UPDATE items SET targetStock=1, minimumStock=1, reorderPoint=1, updatedAt=NOW() WHERE code='6B000000751'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=0, reorderPoint=0, updatedAt=NOW() WHERE code='6LJ58918000'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=1, reorderPoint=0, updatedAt=NOW() WHERE code='6LL46725000'`);
    await queryRunner.query(`UPDATE items SET targetStock=2, minimumStock=2, reorderPoint=2, updatedAt=NOW() WHERE code='6LK49403000'`);
    await queryRunner.query(`UPDATE items SET targetStock=1, minimumStock=1, reorderPoint=1, updatedAt=NOW() WHERE code='6LK46258000'`);
    await queryRunner.query(`UPDATE items SET targetStock=1, minimumStock=1, reorderPoint=1, updatedAt=NOW() WHERE code='6LL05032000'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=0, reorderPoint=0, updatedAt=NOW() WHERE code='6LH54349000'`);
    await queryRunner.query(`UPDATE items SET targetStock=2, minimumStock=2, reorderPoint=2, updatedAt=NOW() WHERE code='6LA81888000'`);
    await queryRunner.query(`UPDATE items SET targetStock=20, minimumStock=11, reorderPoint=15, updatedAt=NOW() WHERE code='6AJ00000236'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=0, reorderPoint=0, updatedAt=NOW() WHERE code='B872-1941'`);
    await queryRunner.query(`UPDATE items SET targetStock=5, minimumStock=10, reorderPoint=5, updatedAt=NOW() WHERE code='6LL43417000'`);
    await queryRunner.query(`UPDATE items SET targetStock=2, minimumStock=2, reorderPoint=2, updatedAt=NOW() WHERE code='F0-01946000'`);
    await queryRunner.query(`UPDATE items SET targetStock=1, minimumStock=1, reorderPoint=1, updatedAt=NOW() WHERE code='6LL43304200'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=0, reorderPoint=0, updatedAt=NOW() WHERE code='6LJ58915000'`);
    await queryRunner.query(`UPDATE items SET targetStock=6, minimumStock=8, reorderPoint=6, updatedAt=NOW() WHERE code='6AJ00000291'`);
    await queryRunner.query(`UPDATE items SET targetStock=2, minimumStock=2, reorderPoint=2, updatedAt=NOW() WHERE code='6LL33301000'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=0, reorderPoint=0, updatedAt=NOW() WHERE code='AX20-0308'`);
    await queryRunner.query(`UPDATE items SET targetStock=1, minimumStock=1, reorderPoint=1, updatedAt=NOW() WHERE code='6AJ00000115'`);
    await queryRunner.query(`UPDATE items SET targetStock=2, minimumStock=2, reorderPoint=2, updatedAt=NOW() WHERE code='6LK67117000'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=0, reorderPoint=0, updatedAt=NOW() WHERE code='6LL15849100'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=0, reorderPoint=0, updatedAt=NOW() WHERE code='6LE60061000'`);
    await queryRunner.query(`UPDATE items SET targetStock=2, minimumStock=2, reorderPoint=2, updatedAt=NOW() WHERE code='6LK48712000'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=0, reorderPoint=0, updatedAt=NOW() WHERE code='AAJV06D'`);
    await queryRunner.query(`UPDATE items SET targetStock=1, minimumStock=1, reorderPoint=1, updatedAt=NOW() WHERE code='6LL50218000'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=0, reorderPoint=0, updatedAt=NOW() WHERE code='6LA34342000'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=0, reorderPoint=0, updatedAt=NOW() WHERE code='6LJ57613000'`);
    await queryRunner.query(`UPDATE items SET targetStock=4, minimumStock=4, reorderPoint=4, updatedAt=NOW() WHERE code='6AJ00000233'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=0, reorderPoint=0, updatedAt=NOW() WHERE code='6LJ66725000'`);
    await queryRunner.query(`UPDATE items SET targetStock=2, minimumStock=4, reorderPoint=2, updatedAt=NOW() WHERE code='6LK49195100'`);
    await queryRunner.query(`UPDATE items SET targetStock=3, minimumStock=2, reorderPoint=3, updatedAt=NOW() WHERE code='6AJ00000162'`);
    await queryRunner.query(`UPDATE items SET targetStock=2, minimumStock=2, reorderPoint=2, updatedAt=NOW() WHERE code='6LK55468000'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=0, reorderPoint=0, updatedAt=NOW() WHERE code='B044-4117'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=0, reorderPoint=0, updatedAt=NOW() WHERE code='6LH51627000'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=0, reorderPoint=0, updatedAt=NOW() WHERE code='6LL05803200'`);
    await queryRunner.query(`UPDATE items SET targetStock=40, minimumStock=200, reorderPoint=40, updatedAt=NOW() WHERE code='RR-00400000'`);
    await queryRunner.query(`UPDATE items SET targetStock=1, minimumStock=1, reorderPoint=1, updatedAt=NOW() WHERE code='6LJ55254000'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=0, reorderPoint=0, updatedAt=NOW() WHERE code='6LH55291100'`);
    await queryRunner.query(`UPDATE items SET targetStock=1, minimumStock=1, reorderPoint=1, updatedAt=NOW() WHERE code='C0-22948000'`);
    await queryRunner.query(`UPDATE items SET targetStock=10, minimumStock=10, reorderPoint=10, updatedAt=NOW() WHERE code='6LJ54274000'`);
    await queryRunner.query(`UPDATE items SET targetStock=5, minimumStock=5, reorderPoint=5, updatedAt=NOW() WHERE code='1T0C0W0UT0'`);
    await queryRunner.query(`UPDATE items SET targetStock=2, minimumStock=2, reorderPoint=2, updatedAt=NOW() WHERE code='6B000001169'`);
    await queryRunner.query(`UPDATE items SET targetStock=3, minimumStock=6, reorderPoint=3, updatedAt=NOW() WHERE code='6LK28354000'`);
    await queryRunner.query(`UPDATE items SET targetStock=1, minimumStock=0, reorderPoint=1, updatedAt=NOW() WHERE code='6LH64642000 B'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=0, reorderPoint=0, updatedAt=NOW() WHERE code='6LA78908000'`);
    await queryRunner.query(`UPDATE items SET targetStock=10, minimumStock=4, reorderPoint=10, updatedAt=NOW() WHERE code='6LK49135000'`);
    await queryRunner.query(`UPDATE items SET targetStock=2, minimumStock=2, reorderPoint=2, updatedAt=NOW() WHERE code='6LK51912000'`);
    await queryRunner.query(`UPDATE items SET targetStock=2, minimumStock=5, reorderPoint=2, updatedAt=NOW() WHERE code='6LK50742000'`);
    await queryRunner.query(`UPDATE items SET targetStock=1, minimumStock=1, reorderPoint=1, updatedAt=NOW() WHERE code='6LH54660000'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=0, reorderPoint=0, updatedAt=NOW() WHERE code='6LH23270000'`);
    await queryRunner.query(`UPDATE items SET targetStock=1, minimumStock=1, reorderPoint=1, updatedAt=NOW() WHERE code='6LJ58734000'`);
    await queryRunner.query(`UPDATE items SET targetStock=2, minimumStock=4, reorderPoint=2, updatedAt=NOW() WHERE code='6LK53971000'`);
    await queryRunner.query(`UPDATE items SET targetStock=5, minimumStock=6, reorderPoint=5, updatedAt=NOW() WHERE code='6AJ00000293'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=0, reorderPoint=0, updatedAt=NOW() WHERE code='6LK25742000'`);
    await queryRunner.query(`UPDATE items SET targetStock=2, minimumStock=4, reorderPoint=2, updatedAt=NOW() WHERE code='AAJW450'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=0, reorderPoint=0, updatedAt=NOW() WHERE code='6LK54180000'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=0, reorderPoint=0, updatedAt=NOW() WHERE code='6A000001578'`);
    await queryRunner.query(`UPDATE items SET targetStock=1, minimumStock=1, reorderPoint=1, updatedAt=NOW() WHERE code='AE03-1035'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=0, reorderPoint=0, updatedAt=NOW() WHERE code='D127-2110'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=0, reorderPoint=0, updatedAt=NOW() WHERE code='B129-3465'`);
    await queryRunner.query(`UPDATE items SET targetStock=6, minimumStock=10, reorderPoint=6, updatedAt=NOW() WHERE code='6AJ00000172'`);
    await queryRunner.query(`UPDATE items SET targetStock=2, minimumStock=2, reorderPoint=2, updatedAt=NOW() WHERE code='6LK7210500'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=0, reorderPoint=0, updatedAt=NOW() WHERE code='6B000000607'`);
    await queryRunner.query(`UPDATE items SET targetStock=4, minimumStock=4, reorderPoint=4, updatedAt=NOW() WHERE code='6LJ57610000'`);
    await queryRunner.query(`UPDATE items SET targetStock=0, minimumStock=0, reorderPoint=0, updatedAt=NOW() WHERE code='6LE58505000 A'`);
    await queryRunner.query(`UPDATE items SET targetStock=1, minimumStock=2, reorderPoint=1, updatedAt=NOW() WHERE code='6LJ55428000'`);
    await queryRunner.query(`UPDATE items SET targetStock=8, minimumStock=15, reorderPoint=8, updatedAt=NOW() WHERE code='6AJ00000238'`);
    await queryRunner.query(`UPDATE items SET targetStock=1, minimumStock=1, reorderPoint=1, updatedAt=NOW() WHERE code='D0A4-2499'`);

    await queryRunner.query(`
      UPDATE stock_levels sl
      INNER JOIN items i ON i.id = sl.itemId
      SET sl.quantity = 11, sl.updatedAt = NOW()
      WHERE i.code = '6LK49135000'
        AND sl.vehicleId IS NULL
        AND sl.locationId IS NOT NULL
        AND sl.quantity = 9
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // No down - data-repair migration
  }
}
