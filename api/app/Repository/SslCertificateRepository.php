<?php
declare(strict_types=1);

namespace App\Repository;

use App\Entity\SslCertificate;
use MonkeysLegion\Repository\EntityRepository;

class SslCertificateRepository extends EntityRepository
{
    protected string $table = 'ssl_certificates';
    protected string $entityClass = SslCertificate::class;

    public function findByDomain(int $domainId): array
    {
        return $this->findBy(['domain_id' => $domainId]);
    }
}
