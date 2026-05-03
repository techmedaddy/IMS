import asyncio
import os
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine
from backend.ims.db.models import WorkItem, RCA, IncidentEvent, WorkItemState

# Override postgres host for local run
os.environ["POSTGRES_HOST"] = "localhost"
os.environ["POSTGRES_USER"] = "postgres"
os.environ["POSTGRES_PASSWORD"] = "postgres"
os.environ["POSTGRES_DB"] = "ims"
os.environ["POSTGRES_PORT"] = "5432"

engine = create_async_engine("postgresql+asyncpg://postgres:postgres@localhost:5432/ims")

async def verify():
    async with engine.connect() as conn:
        print("\n--- Active Incidents per Component ---")
        # Direct SQL query using asyncpg connection is easier, but let's use ORM for safety
        from sqlalchemy.orm import sessionmaker
        from sqlalchemy.ext.asyncio import AsyncSession
        SessionLocal = sessionmaker(engine, class_=AsyncSession)
        
        async with SessionLocal() as session:
            incidents = (await session.execute(select(WorkItem))).scalars().all()
            print(f"Total WorkItems: {len(incidents)}")
            
            active_by_comp = {}
            for inc in incidents:
                if inc.state != WorkItemState.CLOSED:
                    active_by_comp[inc.component_id] = active_by_comp.get(inc.component_id, 0) + 1
            
            for comp, count in active_by_comp.items():
                print(f"Component {comp}: {count} active incidents")
                if count > 1:
                    print(f"FAIL: {comp} has multiple active incidents!")

            print("\n--- RCA Completeness ---")
            rcas = (await session.execute(select(RCA))).scalars().all()
            print(f"Total RCAs: {len(rcas)}")
            for rca in rcas:
                valid = True
                if not rca.root_cause_category or not rca.root_cause_category.strip(): valid = False
                if not rca.fix_applied or not rca.fix_applied.strip(): valid = False
                if not rca.prevention_steps or not rca.prevention_steps.strip(): valid = False
                if rca.end_time < rca.start_time: valid = False
                print(f"RCA {rca.id} valid: {valid}")
                
            print("\n--- IncidentEvent Trace ---")
            events = (await session.execute(select(IncidentEvent))).scalars().all()
            print(f"Total Events: {len(events)}")
            types = {}
            for ev in events:
                types[ev.event_type] = types.get(ev.event_type, 0) + 1
            for t, c in types.items():
                print(f"{t}: {c}")

if __name__ == "__main__":
    asyncio.run(verify())
