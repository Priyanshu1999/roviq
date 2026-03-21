import { createConnectionType } from '../../../common/pagination/relay-pagination.model';
import { InstituteModel } from './institute.model';

export const { ConnectionType: InstituteConnection, EdgeType: InstituteEdge } =
  createConnectionType(InstituteModel, 'Institute');
