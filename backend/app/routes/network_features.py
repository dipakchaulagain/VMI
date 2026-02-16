from flask import Blueprint, jsonify, request
from app import db
from app.models.vm import VM
from app.models.public_network import VMPublicNetwork
from app.models.dns_record import VMDNSRecord
from app.utils.decorators import login_required, admin_required, password_reset_not_required

network_features_bp = Blueprint('network_features', __name__)

@network_features_bp.route('/public-networks', methods=['GET'])
@login_required
@password_reset_not_required
def list_public_networks():
    """List all VMs with public network details"""
    # Join VM to get VM name, etc.
    results = db.session.query(VMPublicNetwork, VM).join(VM).filter(VMPublicNetwork.is_active == True).all()
    
    data = []
    for pn, vm in results:
        pn_dict = pn.to_dict()
        pn_dict['vm_name'] = vm.vm_name
        pn_dict['platform'] = vm.platform
        data.append(pn_dict)
        
    return jsonify({'public_networks': data})

@network_features_bp.route('/dns-records', methods=['GET'])
@login_required
@password_reset_not_required
def list_dns_records():
    """List all VMs with DNS records"""
    results = db.session.query(VMDNSRecord, VM).join(VM).filter(VMDNSRecord.is_active == True).all()
    
    data = []
    for dns, vm in results:
        dns_dict = dns.to_dict()
        dns_dict['vm_name'] = vm.vm_name
        dns_dict['platform'] = vm.platform
        data.append(dns_dict)
        
    return jsonify({'dns_records': data})
