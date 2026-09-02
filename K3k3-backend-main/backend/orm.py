"""
Pydantic v2 schemas for the ride-hailing API.

Naming convention:
  <Model>Base   - shared fields (used by Create and Read)
  <Model>Create - fields accepted on POST  (no auto-generated fields)
  <Model>Update - optional fields accepted on PATCH
  <Model>Read   - full outbound representation (includes id, timestamps, …)
"""


from pydantic import BaseModel, ConfigDict


# ---------------------------------------------------------------------------
# Shared config mixin
# ---------------------------------------------------------------------------

class ORMBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)