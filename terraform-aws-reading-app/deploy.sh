#!/usr/bin/env bash
# Despliega Reading Champions en AWS (ECR + EC2 t3.micro + CloudFront).
# Uso (desde WSL, en la raiz del proyecto):  bash terraform-aws-reading-app/deploy.sh
set -euo pipefail

TF_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$TF_DIR")"
REGION="${AWS_REGION:-us-east-1}"
tf() { terraform -chdir="$TF_DIR" "$@"; }

echo "==> Verificando credenciales de AWS"
aws sts get-caller-identity >/dev/null

if [ ! -f "$TF_DIR/terraform.tfvars" ]; then
  echo "Falta $TF_DIR/terraform.tfvars (copia terraform.tfvars.example y pon admin_password)" >&2
  exit 1
fi

echo "==> terraform init"
tf init -upgrade -input=false

echo "==> Creando (o verificando) el repositorio ECR"
tf apply -input=false -auto-approve -target=aws_ecr_repository.app -target=aws_ecr_lifecycle_policy.app

ECR="$(tf output -raw ecr_repository_url)"
echo "==> Login en ECR: ${ECR%%/*}"
aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "${ECR%%/*}"

echo "==> Construyendo y subiendo la imagen"
docker build --target prod --platform linux/amd64 -t "$ECR:latest" "$ROOT"
docker push "$ECR:latest"

# Si la instancia ya existe, se actualiza la app despues del apply
EXISTING="$(tf output -raw instance_id 2>/dev/null || true)"

echo "==> Plan completo"
tf plan -input=false -out=tfplan
read -r -p "Aplicar este plan? (escribe yes): " ok
[ "$ok" = "yes" ] || { rm -f "$TF_DIR/tfplan"; echo "Cancelado"; exit 1; }
tf apply -input=false tfplan
rm -f "$TF_DIR/tfplan"

if [[ "$EXISTING" == i-* ]]; then
  echo "==> Actualizando la app en la instancia $EXISTING (via SSM)"
  aws ssm send-command --region "$REGION" --instance-ids "$EXISTING" \
    --document-name AWS-RunShellScript \
    --parameters 'commands=["/opt/reading-app/update.sh"]' \
    --query 'Command.CommandId' --output text
fi

echo
echo "==> Listo. App: $(tf output -raw app_url)"
echo "    La primera vez, CloudFront tarda unos minutos en propagarse y la instancia"
echo "    unos 3-5 minutos en instalar Docker y arrancar la app."
