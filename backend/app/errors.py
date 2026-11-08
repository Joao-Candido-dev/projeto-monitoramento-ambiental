from dataclasses import dataclass


@dataclass
class ServiceError(Exception):
    status: int
    code: str
    message: str
    field: str | None = None

    def response(self):
        error = {'code': self.code, 'message': self.message}
        if self.field:
            error['field'] = self.field
        return {'error': error}, self.status
